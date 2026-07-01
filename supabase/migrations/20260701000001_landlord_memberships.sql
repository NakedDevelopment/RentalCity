-- Landlord annual membership ($350/yr auto-renewing Stripe subscription).
-- A landlord must have an active membership before they can list/publish a property.
-- Rows are written by the backend (service role) from Stripe Checkout confirm + webhooks.

CREATE TABLE IF NOT EXISTS landlord_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  -- 'active' | 'past_due' | 'canceled' | 'inactive'
  status TEXT NOT NULL DEFAULT 'inactive',
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS landlord_memberships_landlord_id_idx
  ON landlord_memberships (landlord_id);

ALTER TABLE landlord_memberships ENABLE ROW LEVEL SECURITY;

-- Landlords may read their own membership. All writes go through the backend
-- service role, which bypasses RLS, so no insert/update/delete policies are granted.
DROP POLICY IF EXISTS "Landlord reads own membership" ON landlord_memberships;
CREATE POLICY "Landlord reads own membership" ON landlord_memberships
  FOR SELECT USING (landlord_id = auth.uid());
