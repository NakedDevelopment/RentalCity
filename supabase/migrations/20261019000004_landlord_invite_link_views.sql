-- Track external (non-owner) visits to a landlord's invite link so admins can see
-- which landlords are actually sharing their link.
ALTER TABLE public.landlord_invite_links ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;

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
  -- Only count external visits — not the landlord previewing their own link.
  IF auth.uid() IS DISTINCT FROM v_landlord_id THEN
    UPDATE public.landlord_invite_links
    SET view_count = view_count + 1
    WHERE token = invite_token;
  END IF;
  RETURN jsonb_build_object(
    'ok', true,
    'landlord_id', v_landlord_id,
    'landlord_name', COALESCE(NULLIF(trim(v_name), ''), 'Your host')
  );
END;
$$;
