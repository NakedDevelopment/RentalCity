-- Property invitations keep their listing as the initial destination, while
-- the 14-day restriction still applies to ALL active listings of the landlord.
-- A second landlord's invitation cannot replace an active restriction.
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
  v_property UUID;
  v_ends TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF v_role IS DISTINCT FROM 'tenant' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'tenants_only');
  END IF;
  SELECT l.landlord_id, p.display_name,
    CASE WHEN prop.status = 'active' THEN l.property_id ELSE NULL END
  INTO v_landlord, v_name, v_property
  FROM public.landlord_invite_links l
  JOIN public.profiles p ON p.id = l.landlord_id
  LEFT JOIN public.properties prop
    ON prop.id = l.property_id AND prop.landlord_id = l.landlord_id
  WHERE l.token = invite_token
    AND (l.property_id IS NULL OR prop.id IS NOT NULL)
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
    redeemed_at = CASE
      WHEN tenant_invite_restrictions.ends_at > now()
      THEN tenant_invite_restrictions.redeemed_at
      ELSE EXCLUDED.redeemed_at
    END,
    ends_at = CASE
      WHEN tenant_invite_restrictions.ends_at > now()
      THEN tenant_invite_restrictions.ends_at
      ELSE EXCLUDED.ends_at
    END
  WHERE tenant_invite_restrictions.ends_at <= now()
     OR tenant_invite_restrictions.landlord_id = EXCLUDED.landlord_id
  RETURNING ends_at INTO v_ends;

  IF v_ends IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'active_invite');
  END IF;
  RETURN jsonb_build_object(
    'ok', true, 'landlord_id', v_landlord,
    'property_id', v_property, 'ends_at', v_ends
  );
END;
$$;