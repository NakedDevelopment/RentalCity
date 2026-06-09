-- Expand Plaid verification with identity match, detailed income streams,
-- proof-of-funds reserves, and debts / debt-to-income.

ALTER TABLE plaid_financial_verifications
  ADD COLUMN IF NOT EXISTS total_assets_cents BIGINT,
  ADD COLUMN IF NOT EXISTS debts_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS total_monthly_debt_cents BIGINT,
  ADD COLUMN IF NOT EXISTS dti_ratio NUMERIC,
  ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS name_on_account TEXT,
  -- Nested detail: income_streams[], accounts[], debts[], identity{}
  ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;
