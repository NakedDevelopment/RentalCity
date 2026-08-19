-- QA-found fixes for the Equifax credit-check redesign:
--
-- 1. Prevent a double-click/double-tab race from creating two credit-report
--    rows for the same landlord+tenant+application window (which would both
--    trigger a real, billable Equifax pull and break downstream .maybeSingle()
--    lookups once duplicates exist).
ALTER TABLE equifax_credit_reports
  ADD CONSTRAINT equifax_credit_reports_landlord_tenant_app_unique
  UNIQUE (landlord_id, tenant_id, universal_application_id);

-- 2. tenant_credit_consent's only write path in this app is the server's
--    /api/equifax/consent route (service role, which always AES-256-GCM
--    encrypts the SSN before writing). The prior "FOR ALL USING (auth.uid() =
--    tenant_id)" policy let a tenant write directly to this table via the
--    Supabase client with the anon key — including writing an unencrypted
--    SSN into ssn_encrypted, since Postgres uses USING as the WITH CHECK
--    expression by default when none is given. Restrict tenants to read-only;
--    only the service role (which bypasses RLS) may write.
DROP POLICY IF EXISTS "tenant_manage_own_consent" ON tenant_credit_consent;
CREATE POLICY "tenant_read_own_consent" ON tenant_credit_consent
  FOR SELECT USING (auth.uid() = tenant_id);
