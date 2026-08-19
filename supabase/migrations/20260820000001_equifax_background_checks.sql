-- Replace the BackgroundChecks.com integration with the real Equifax products:
-- NCIS-Alias (criminal) and AssuredTenant Alias (eviction). Both tables are
-- currently empty in production, so this redesigns them cleanly rather than
-- migrating live data.

-- 1. tenant_credit_consent gains date_of_birth — NCIS-Alias requires DOB in
--    addition to name+SSN, which credit checks alone didn't need. Reuses the
--    same consent record (encrypted, one-time collection) for both checks
--    rather than collecting sensitive data from the tenant a second time.
ALTER TABLE tenant_credit_consent
  ADD COLUMN date_of_birth_encrypted TEXT NOT NULL DEFAULT '';
ALTER TABLE tenant_credit_consent
  ALTER COLUMN date_of_birth_encrypted DROP DEFAULT;

-- 2. universal_application_screenings -> equifax_background_checks.
--    Drops BackgroundChecks.com-specific fields (provider, environment,
--    report_sku, applicant_email, report_key, applicant_invite_url,
--    background_status, employment_status, income_pass — income/employment
--    verification is Plaid's job, not this integration's). Stores only a
--    computed pass/fail per check, never the underlying case/offense/eviction
--    record details.
ALTER TABLE universal_application_screenings RENAME TO equifax_background_checks;

ALTER TABLE equifax_background_checks
  DROP COLUMN provider,
  DROP COLUMN environment,
  DROP COLUMN report_sku,
  DROP COLUMN applicant_email,
  DROP COLUMN report_key,
  DROP COLUMN applicant_invite_url,
  DROP COLUMN report_status,
  DROP COLUMN background_status,
  DROP COLUMN employment_status,
  DROP COLUMN income_pass,
  DROP COLUMN background_pass;

ALTER TABLE equifax_background_checks
  ADD COLUMN status TEXT NOT NULL DEFAULT 'none'
    CHECK (status IN ('none', 'pending', 'complete', 'failed')),
  ADD COLUMN criminal_pass BOOLEAN,
  ADD COLUMN eviction_pass BOOLEAN,
  ADD COLUMN checked_at TIMESTAMPTZ;

-- Same defense-in-depth fix already applied to tenant_credit_consent: only
-- the server (service role, always computing pass/fail itself) should ever
-- write here. Tenants get read-only access to their own row.
DROP POLICY IF EXISTS "Tenants can manage own universal application screenings" ON equifax_background_checks;
CREATE POLICY "tenant_read_own_background_check" ON equifax_background_checks
  FOR SELECT USING (auth.uid() = tenant_id);

-- 3. The prior landlord-read policy only required SOME relationship with the
--    tenant (an application of any status, a message thread, a rating, an
--    invite restriction) — not the $200 per-tenant unlock. Same gap found and
--    fixed for credit checks this session; fixing it here too, since this
--    table is read directly by the landlord's browser via RLS (unlike credit,
--    which is server-mediated), so RLS is the actual enforcement point.
DROP POLICY IF EXISTS "Landlords can read universal application screenings for matched" ON equifax_background_checks;
CREATE POLICY "Landlords can read equifax background checks for unlocked tenants" ON equifax_background_checks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.properties p ON p.id = a.property_id
      WHERE a.tenant_id = equifax_background_checks.tenant_id
        AND p.landlord_id = auth.uid()
        AND (a.status IN ('approved', 'rejected') OR (a.status = 'pending' AND a.unlocked_at IS NOT NULL))
    )
    AND EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.equifax_approved_at IS NOT NULL
        AND pr.plaid_agreement_signed_at IS NOT NULL
    )
  );
