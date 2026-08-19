-- Landlord DocuSign agreements: Plaid End Client Consent (self-serve, no external
-- approval) alongside the existing Equifax Broker Subscriber Agreement columns
-- (equifax_approved_at / docusign_envelope_id / docusign_envelope_status, added in
-- 20260811000001_equifax_credit_checks.sql).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plaid_agreement_envelope_id text,
  ADD COLUMN IF NOT EXISTS plaid_agreement_signed_at timestamptz;
