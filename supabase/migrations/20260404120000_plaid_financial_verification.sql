-- Plaid integration: store per-tenant Plaid item (access token) and derived
-- income + bank balance verification results.

-- Server-only table holding the sensitive Plaid access token. RLS is enabled
-- with NO policies so the anon/auth clients can never read it; the Express
-- server uses the service role key (which bypasses RLS) for all access.
CREATE TABLE IF NOT EXISTS plaid_items (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  item_id TEXT,
  institution_name TEXT,
  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'development', 'production')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER plaid_items_updated_at
  BEFORE UPDATE ON plaid_items
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: only the service role may touch this table.

-- Summary verification results shown in-app (no raw bank data stored here).
CREATE TABLE IF NOT EXISTS plaid_financial_verifications (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  institution_name TEXT,
  accounts_count INTEGER NOT NULL DEFAULT 0,

  -- Income (verified from recurring bank deposits / payroll inflows)
  income_verified BOOLEAN NOT NULL DEFAULT false,
  verified_monthly_income_cents BIGINT,

  -- Balances / assets
  balances_verified BOOLEAN NOT NULL DEFAULT false,
  available_balance_cents BIGINT,
  current_balance_cents BIGINT,

  environment TEXT NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'development', 'production')),
  last_verified_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TRIGGER plaid_financial_verifications_updated_at
  BEFORE UPDATE ON plaid_financial_verifications
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

ALTER TABLE plaid_financial_verifications ENABLE ROW LEVEL SECURITY;

-- Tenants can read their own verification summary.
DROP POLICY IF EXISTS "Tenants can read own plaid verification" ON plaid_financial_verifications;
CREATE POLICY "Tenants can read own plaid verification"
  ON plaid_financial_verifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Landlords can read a tenant's verification when they already have access to
-- that tenant (applied to their property, in a message thread, rated, or
-- holding an active invite restriction) -- mirrors universal_application_screenings.
DROP POLICY IF EXISTS "Landlords can read plaid verification for matched tenants" ON plaid_financial_verifications;
CREATE POLICY "Landlords can read plaid verification for matched tenants"
  ON plaid_financial_verifications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.properties p ON p.id = a.property_id
      WHERE a.tenant_id = plaid_financial_verifications.user_id
        AND p.landlord_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.message_threads mt
      WHERE mt.tenant_id = plaid_financial_verifications.user_id
        AND mt.landlord_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_ratings tr
      WHERE tr.landlord_id = auth.uid()
        AND (
          tr.tenant_external_id = plaid_financial_verifications.user_id::text
          OR (tr.tenant_id IS NOT NULL AND tr.tenant_id = plaid_financial_verifications.user_id)
        )
    )
    OR EXISTS (
      SELECT 1
      FROM public.tenant_invite_restrictions tir
      WHERE tir.tenant_id = plaid_financial_verifications.user_id
        AND tir.landlord_id = auth.uid()
        AND tir.ends_at > now()
    )
  );
