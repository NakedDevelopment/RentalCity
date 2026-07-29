-- Plaid Identity Verification, Income range, and Asset tier upgrade.
--
-- 1. profiles: add columns to track the Plaid Identity Verification session
--    initiated during tenant onboarding.
-- 2. plaid_financial_verifications: add income range and asset tier columns
--    so landlords can see specific numbers (not just boolean signals) after
--    paying to unlock a tenant profile.

-- Identity Verification session on the tenant profile
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS identity_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS identity_verification_session_id TEXT,
  ADD COLUMN IF NOT EXISTS identity_verification_status TEXT
    CHECK (identity_verification_status IN (
      'pending', 'active', 'success', 'failed', 'expired', 'canceled'
    ));

-- Income range and asset tier on the financial verification summary.
-- These are derived signal values (ranges, tiers) — no raw dollar amounts.
ALTER TABLE plaid_financial_verifications
  ADD COLUMN IF NOT EXISTS monthly_income_range_low_cents BIGINT,
  ADD COLUMN IF NOT EXISTS monthly_income_range_high_cents BIGINT,
  ADD COLUMN IF NOT EXISTS asset_tier TEXT
    CHECK (asset_tier IN ('low', 'moderate', 'high', 'very_high'));
