-- A property has one stable invite token until it is deleted. Generic landlord
-- invite rows continue to have no property_id.
ALTER TABLE public.landlord_invite_links
  ADD COLUMN property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX landlord_invite_links_one_per_property
  ON public.landlord_invite_links(property_id);

-- Restrict direct browser writes to generic links. Property links are created
-- by a trusted trigger when the property is inserted, including drafts.
DROP POLICY "Landlords manage own invite links" ON public.landlord_invite_links;
CREATE POLICY "Landlords read own invite links" ON public.landlord_invite_links
  FOR SELECT USING (
    landlord_id = auth.uid()
    AND (property_id IS NULL OR EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.landlord_id = auth.uid()
    ))
  );
CREATE POLICY "Landlords create generic invite links" ON public.landlord_invite_links
  FOR INSERT WITH CHECK (landlord_id = auth.uid() AND property_id IS NULL);
CREATE POLICY "Landlords delete generic invite links" ON public.landlord_invite_links
  FOR DELETE USING (landlord_id = auth.uid() AND property_id IS NULL);

CREATE FUNCTION public.create_property_invite_link()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.landlord_invite_links(landlord_id, property_id)
  VALUES (NEW.landlord_id, NEW.id)
  ON CONFLICT (property_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_property_invite_link_after_insert
  AFTER INSERT ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.create_property_invite_link();

-- Existing properties get the same stable link without republishing.
INSERT INTO public.landlord_invite_links(landlord_id, property_id)
SELECT p.landlord_id, p.id FROM public.properties p
ON CONFLICT (property_id) DO NOTHING;

-- Preview remains safe for anonymous visitors: no property ID is returned.
-- If the property changes owner, do not allow an outdated token to claim the
-- former landlord's inventory.
CREATE OR REPLACE FUNCTION public.preview_landlord_invite(invite_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landlord_id UUID;
  v_name TEXT;
BEGIN
  SELECT l.landlord_id, p.display_name
  INTO v_landlord_id, v_name
  FROM public.landlord_invite_links l
  JOIN public.profiles p ON p.id = l.landlord_id
  WHERE l.token = invite_token
    AND (l.property_id IS NULL OR EXISTS (
      SELECT 1 FROM public.properties prop
      WHERE prop.id = l.property_id AND prop.landlord_id = l.landlord_id
    ))
  LIMIT 1;
  IF v_landlord_id IS NULL THEN
    RETURN jsonb_build_object('ok', false);
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'landlord_id', v_landlord_id,
    'landlord_name', COALESCE(NULLIF(trim(v_name), ''), 'Your host')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.redeem_landlord_invite(invite_token UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_landlord UUID;
  v_role public.user_role;
  v_name TEXT;
  v_ends TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'tenant' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenants_only');
  END IF;
  SELECT l.landlord_id, p.display_name
  INTO v_landlord, v_name
  FROM public.landlord_invite_links l
  JOIN public.profiles p ON p.id = l.landlord_id
  WHERE l.token = invite_token
    AND (l.property_id IS NULL OR EXISTS (
      SELECT 1 FROM public.properties prop
      WHERE prop.id = l.property_id AND prop.landlord_id = l.landlord_id
    ))
  LIMIT 1;
  IF v_landlord IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  v_ends := now() + interval '14 days';
  INSERT INTO public.tenant_invite_restrictions
    (tenant_id, landlord_id, landlord_display_name, redeemed_at, ends_at)
  VALUES (
    auth.uid(), v_landlord,
    COALESCE(NULLIF(trim(v_name), ''), 'Your host'),
    now(), v_ends
  )
  ON CONFLICT (tenant_id) DO UPDATE SET
    landlord_id = EXCLUDED.landlord_id,
    landlord_display_name = EXCLUDED.landlord_display_name,
    -- Clicking the same invite twice must not extend an active window.
    redeemed_at = CASE
      WHEN tenant_invite_restrictions.landlord_id = EXCLUDED.landlord_id
        AND tenant_invite_restrictions.ends_at > now()
      THEN tenant_invite_restrictions.redeemed_at
      ELSE EXCLUDED.redeemed_at
    END,
    ends_at = CASE
      WHEN tenant_invite_restrictions.landlord_id = EXCLUDED.landlord_id
        AND tenant_invite_restrictions.ends_at > now()
      THEN tenant_invite_restrictions.ends_at
      ELSE EXCLUDED.ends_at
    END
  RETURNING ends_at INTO v_ends;
  RETURN jsonb_build_object('ok', true, 'landlord_id', v_landlord, 'ends_at', v_ends);
END;
$$;