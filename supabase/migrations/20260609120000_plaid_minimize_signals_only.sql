-- Data minimization / compliance: the Plaid verification feature now persists
-- ONLY verification signals + the computed debt-to-income ratio. Raw financial
-- figures, per-account/income/debt breakdowns, the account-holder name, and any
-- contact PII must never be stored.
--
-- Dropping these columns (1) permanently removes any historical raw data that
-- pre-redesign rows may still hold, and (2) makes it structurally impossible
-- for the server to store -- or for landlords (who have row-level SELECT) to
-- read -- anything beyond signals. The remaining columns are all non-sensitive
-- signals, so the existing landlord read policy now exposes signals only.
ALTER TABLE plaid_financial_verifications
  DROP COLUMN IF EXISTS verified_monthly_income_cents,
  DROP COLUMN IF EXISTS available_balance_cents,
  DROP COLUMN IF EXISTS current_balance_cents,
  DROP COLUMN IF EXISTS total_assets_cents,
  DROP COLUMN IF EXISTS total_monthly_debt_cents,
  DROP COLUMN IF EXISTS name_on_account,
  DROP COLUMN IF EXISTS details;
