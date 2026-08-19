-- Scope Equifax credit consent to a specific 6-month universal application window
-- (mirrors universal_application_screenings' pattern for background checks),
-- instead of one consent row per tenant forever. This lets the encrypted SSN be
-- purged the moment a tenant's application lapses or is renewed, rather than
-- being retained indefinitely.

ALTER TABLE tenant_credit_consent
  ADD COLUMN universal_application_id UUID REFERENCES universal_applications(id) ON DELETE CASCADE;

-- Table is currently empty in production, so a plain backfill-free NOT NULL is safe.
ALTER TABLE tenant_credit_consent
  ALTER COLUMN universal_application_id SET NOT NULL;

ALTER TABLE tenant_credit_consent DROP CONSTRAINT tenant_credit_consent_pkey;
ALTER TABLE tenant_credit_consent ADD COLUMN id UUID PRIMARY KEY DEFAULT gen_random_uuid();
ALTER TABLE tenant_credit_consent ADD CONSTRAINT tenant_credit_consent_tenant_app_unique
  UNIQUE (tenant_id, universal_application_id);

CREATE INDEX idx_tenant_credit_consent_universal_application
  ON tenant_credit_consent(universal_application_id);

-- Scope credit-report requests to the universal application window they were
-- pulled under too, so a renewed (new-window) tenant doesn't show a stale
-- "Complete" status/PDF link from a prior, now-expired window.
ALTER TABLE equifax_credit_reports
  ADD COLUMN universal_application_id UUID REFERENCES universal_applications(id) ON DELETE CASCADE;

CREATE INDEX idx_equifax_credit_reports_universal_application
  ON equifax_credit_reports(universal_application_id);

-- Real, scheduled destruction of the encrypted SSN once it's no longer needed
-- (Equifax Broker Subscriber Agreement, Section VI(f): "Equifax Information...
-- securely destroyed when no longer needed"). Applies the same standard to the
-- SSN itself, not just data received from Equifax.
CREATE EXTENSION IF NOT EXISTS pg_cron;

SELECT cron.schedule(
  'purge-expired-credit-consent',
  '0 3 * * *',
  $$
  DELETE FROM tenant_credit_consent
  WHERE universal_application_id IN (
    SELECT id FROM universal_applications
    WHERE status <> 'active' OR valid_until < now()
  );
  $$
);
