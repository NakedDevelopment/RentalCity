-- Rebuilds Plaid financial verification around the three products this
-- account actually has: Assets, Income Verification (Bank Income), and
-- Identity Verification (unused by this card — kept separate).
-- Transactions/Liabilities/Identity (plain) were never approved and are
-- dropped from this flow entirely.
-- 2026-09-18
--
-- Assets and Bank Income are asynchronous, webhook-driven report products
-- (unlike the old synchronous transactions/liabilities/identity calls), so
-- verification now has a processing lifecycle.

ALTER TABLE plaid_financial_verifications
  ADD COLUMN IF NOT EXISTS status TEXT;

-- Rows created by the previous synchronous Plaid flow already contain their
-- final computed verification data. Preserve those as complete; only new
-- report-based requests should enter the processing lifecycle.
UPDATE plaid_financial_verifications
SET status = 'complete'
WHERE status IS NULL;

ALTER TABLE plaid_financial_verifications
  ALTER COLUMN status SET DEFAULT 'processing',
  ALTER COLUMN status SET NOT NULL;

ALTER TABLE plaid_financial_verifications
  DROP CONSTRAINT IF EXISTS plaid_financial_verifications_status_check;
ALTER TABLE plaid_financial_verifications
  ADD CONSTRAINT plaid_financial_verifications_status_check
    CHECK (status IN ('processing', 'complete', 'failed'));

-- asset_report_id (webhook lookup key) and asset_report_token (needed to call
-- /asset_report/get once the webhook fires) live on plaid_items, which
-- already holds the Plaid access_token and has zero client-facing RLS
-- policies — not on plaid_financial_verifications, which landlords and
-- tenants can read directly.
ALTER TABLE plaid_items
  ADD COLUMN IF NOT EXISTS asset_report_id TEXT,
  ADD COLUMN IF NOT EXISTS asset_report_token TEXT;
