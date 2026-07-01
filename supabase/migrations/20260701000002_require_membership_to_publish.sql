-- Enforce the landlord annual membership at the write boundary: a landlord may
-- only create or keep a property in the 'active' (published) state while they
-- hold an active, unexpired membership. Draft properties remain unrestricted so
-- landlords can prepare listings before subscribing. This backs the UI gate on
-- the onboarding intro with server-authoritative enforcement.

-- SECURITY DEFINER so the check can read landlord_memberships (which is RLS-locked
-- to the owner) consistently; it only ever inspects the current caller's own row.
CREATE OR REPLACE FUNCTION public.landlord_has_active_membership()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.landlord_memberships m
    WHERE m.landlord_id = auth.uid()
      AND m.status = 'active'
      AND (m.current_period_end IS NULL OR m.current_period_end > now())
  );
$$;

REVOKE ALL ON FUNCTION public.landlord_has_active_membership() FROM public;
GRANT EXECUTE ON FUNCTION public.landlord_has_active_membership() TO authenticated;

-- Publishing via INSERT (e.g. the add-property preview flow) requires membership.
DROP POLICY IF EXISTS "Landlords can insert own properties" ON properties;
CREATE POLICY "Landlords can insert own properties" ON properties
  FOR INSERT WITH CHECK (
    landlord_id = auth.uid()
    AND (status IS DISTINCT FROM 'active' OR public.landlord_has_active_membership())
  );

-- Publishing via UPDATE (e.g. republishing a draft) requires membership. The
-- WITH CHECK inspects the resulting row, so any row left in 'active' state must
-- be backed by an active membership.
DROP POLICY IF EXISTS "Landlords can update own properties" ON properties;
CREATE POLICY "Landlords can update own properties" ON properties
  FOR UPDATE USING (landlord_id = auth.uid())
  WITH CHECK (
    landlord_id = auth.uid()
    AND (status IS DISTINCT FROM 'active' OR public.landlord_has_active_membership())
  );
