-- Per-landlord Equifax OneView production credentials
-- 2026-09-18
--
-- Rental City is a reseller: Rental City's own Equifax account is
-- permanently test-tier. Each landlord onboarded as a subscriber gets their
-- own production member number, security code, and customer code from
-- Equifax (confirmed by Equifax rep 2026-09-18). Admin enters these on the
-- landlord's behalf; the landlord never needs to see or manage them in-app.

CREATE TABLE IF NOT EXISTS equifax_landlord_credentials (
  landlord_id             UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  member_number_encrypted TEXT NOT NULL,
  member_number_last4     TEXT NOT NULL,
  security_code_encrypted TEXT NOT NULL,
  security_code_last4     TEXT NOT NULL,
  customer_code_encrypted TEXT NOT NULL,
  customer_code_last4     TEXT NOT NULL,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE equifax_landlord_credentials ENABLE ROW LEVEL SECURITY;

-- No policies at all: only the service role (used by the admin approve
-- endpoint and the credit-check endpoint) may read or write this table.
-- Neither the landlord nor any other authenticated user can select it.

-- Each equifax_credit_reports row records which Equifax host actually
-- serviced it, so the PDF proxy can re-derive the correct host later
-- instead of trusting the process-wide EQUIFAX_ENV, which may have moved on.
ALTER TABLE equifax_credit_reports
  ADD COLUMN IF NOT EXISTS environment TEXT NOT NULL DEFAULT 'uat';

ALTER TABLE equifax_credit_reports
  DROP CONSTRAINT IF EXISTS equifax_credit_reports_environment_check;
ALTER TABLE equifax_credit_reports
  ADD CONSTRAINT equifax_credit_reports_environment_check
    CHECK (environment IN ('sandbox', 'uat', 'production'));
