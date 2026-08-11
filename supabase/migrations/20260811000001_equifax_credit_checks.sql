-- Equifax credit check tables + landlord approval columns
-- 2026-08-11

-- 1. Equifax / DocuSign approval fields on landlord profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS equifax_approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS equifax_pending_since TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS docusign_envelope_id TEXT,
  ADD COLUMN IF NOT EXISTS docusign_envelope_status TEXT;

-- 2. Tenant credit consent
--    Stores AES-256-GCM encrypted SSN + address fields needed for Equifax pull.
--    No plain-text SSN is ever persisted here.
CREATE TABLE IF NOT EXISTS tenant_credit_consent (
  tenant_id    UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  ssn_encrypted TEXT NOT NULL,
  first_name   TEXT NOT NULL,
  last_name    TEXT NOT NULL,
  house_number TEXT NOT NULL,
  street_name  TEXT NOT NULL,
  street_type  TEXT NOT NULL DEFAULT 'ST',
  city         TEXT NOT NULL,
  state        CHAR(2) NOT NULL,
  zip          TEXT NOT NULL,
  consent_given_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_credit_consent ENABLE ROW LEVEL SECURITY;

-- Only the tenant can read/write their own record.
-- The service role (used by the server when a landlord triggers a pull) bypasses RLS.
CREATE POLICY "tenant_manage_own_consent" ON tenant_credit_consent
  FOR ALL USING (auth.uid() = tenant_id);

-- 3. Equifax credit report requests — one row per landlord+tenant pull
CREATE TABLE IF NOT EXISTS equifax_credit_reports (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  equifax_report_id TEXT,
  status           TEXT NOT NULL DEFAULT 'pending',
  requested_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at     TIMESTAMPTZ,
  CONSTRAINT equifax_credit_reports_status_check
    CHECK (status IN ('pending', 'complete', 'failed'))
);

ALTER TABLE equifax_credit_reports ENABLE ROW LEVEL SECURITY;

-- Landlord sees their own requests; tenant sees reports about them
CREATE POLICY "landlord_own_credit_reports" ON equifax_credit_reports
  FOR SELECT USING (auth.uid() = landlord_id);

CREATE POLICY "tenant_own_credit_reports" ON equifax_credit_reports
  FOR SELECT USING (auth.uid() = tenant_id);
