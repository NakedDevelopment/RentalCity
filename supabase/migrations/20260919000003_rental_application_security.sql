-- Keep private application PII out of profiles, which related landlords can read.
CREATE TABLE IF NOT EXISTS tenant_application_profiles (
  tenant_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  date_of_birth DATE,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  emergency_contact_name TEXT,
  emergency_contact_relationship TEXT,
  emergency_contact_phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tenant_application_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Tenants manage own private application profile"
  ON tenant_application_profiles
  FOR ALL
  USING (tenant_id = auth.uid())
  WITH CHECK (tenant_id = auth.uid());

INSERT INTO tenant_application_profiles (
  tenant_id, date_of_birth, address_line1, address_line2, city, state, postal_code,
  emergency_contact_name, emergency_contact_relationship, emergency_contact_phone
)
SELECT
  id, date_of_birth, address_line1, address_line2, city, state, postal_code,
  emergency_contact_name, emergency_contact_relationship, emergency_contact_phone
FROM profiles
WHERE date_of_birth IS NOT NULL
   OR address_line1 IS NOT NULL
   OR emergency_contact_name IS NOT NULL
ON CONFLICT (tenant_id) DO NOTHING;

ALTER TABLE profiles
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS address_line1,
  DROP COLUMN IF EXISTS address_line2,
  DROP COLUMN IF EXISTS state,
  DROP COLUMN IF EXISTS postal_code,
  DROP COLUMN IF EXISTS emergency_contact_name,
  DROP COLUMN IF EXISTS emergency_contact_relationship,
  DROP COLUMN IF EXISTS emergency_contact_phone;

-- Paid application state is written only by the service role.
DROP POLICY IF EXISTS "Tenants can manage own universal applications" ON universal_applications;
CREATE POLICY "Tenants can read own universal applications"
  ON universal_applications
  FOR SELECT
  USING (tenant_id = auth.uid());

-- Property applications are created through validated server RPCs.
DROP POLICY IF EXISTS "Tenants can insert own applications" ON applications;

-- Repair any legacy duplicate active windows before enforcing one per tenant.
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) AS rn
  FROM universal_applications
  WHERE status = 'active'
)
UPDATE universal_applications ua
SET status = 'expired'
FROM ranked r
WHERE ua.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_universal_application_per_tenant
  ON universal_applications(tenant_id)
  WHERE status = 'active';

CREATE OR REPLACE FUNCTION complete_rental_application(p_tenant_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ua universal_applications%ROWTYPE;
  app_id UUID;
BEGIN
  SELECT * INTO ua
  FROM universal_applications
  WHERE tenant_id = p_tenant_id
    AND status = 'active'
    AND valid_until > now()
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF ua.id IS NULL THEN RAISE EXCEPTION 'No active paid application was found.'; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM profiles p
    JOIN tenant_application_profiles tap ON tap.tenant_id = p.id
    WHERE p.id = p_tenant_id
      AND nullif(trim(p.display_name), '') IS NOT NULL
      AND nullif(trim(p.phone), '') IS NOT NULL
      AND nullif(trim(p.bio), '') IS NOT NULL
      AND tap.date_of_birth IS NOT NULL
      AND nullif(trim(tap.address_line1), '') IS NOT NULL
      AND nullif(trim(tap.city), '') IS NOT NULL
      AND nullif(trim(tap.state), '') IS NOT NULL
      AND nullif(trim(tap.postal_code), '') IS NOT NULL
      AND nullif(trim(tap.emergency_contact_name), '') IS NOT NULL
      AND nullif(trim(tap.emergency_contact_relationship), '') IS NOT NULL
      AND nullif(trim(tap.emergency_contact_phone), '') IS NOT NULL
  ) THEN RAISE EXCEPTION 'Complete your personal and emergency contact information first.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_preferences tp
    WHERE tp.user_id = p_tenant_id
      AND tp.move_in_date IS NOT NULL
      AND tp.lease_length_months IS NOT NULL
      AND tp.min_budget_cents IS NOT NULL
      AND tp.max_budget_cents IS NOT NULL
  ) THEN RAISE EXCEPTION 'Complete your application review first.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM tenant_credit_consent tcc
    WHERE tcc.tenant_id = p_tenant_id AND tcc.universal_application_id = ua.id
  ) THEN RAISE EXCEPTION 'Credit and background authorization is required.'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM plaid_financial_verifications pfv
    WHERE pfv.user_id = p_tenant_id AND pfv.income_verified = true
  ) THEN RAISE EXCEPTION 'Income verification is required.'; END IF;

  IF ua.triggering_property_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM properties p WHERE p.id = ua.triggering_property_id AND p.status = 'active'
    ) THEN RAISE EXCEPTION 'The property is no longer available.'; END IF;

    INSERT INTO applications (tenant_id, property_id, status)
    VALUES (p_tenant_id, ua.triggering_property_id, 'pending')
    ON CONFLICT (tenant_id, property_id)
    DO UPDATE SET updated_at = applications.updated_at
    RETURNING id INTO app_id;
  END IF;

  UPDATE universal_applications
  SET wizard_completed_at = COALESCE(wizard_completed_at, now())
  WHERE id = ua.id;

  RETURN app_id;
END;
$$;

CREATE OR REPLACE FUNCTION apply_to_property(p_tenant_id UUID, p_property_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE app_id UUID;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM universal_applications
    WHERE tenant_id = p_tenant_id
      AND status = 'active'
      AND valid_until > now()
      AND wizard_completed_at IS NOT NULL
  ) THEN RAISE EXCEPTION 'Complete your rental application before applying.'; END IF;

  IF NOT EXISTS (SELECT 1 FROM properties WHERE id = p_property_id AND status = 'active')
  THEN RAISE EXCEPTION 'The property is no longer available.'; END IF;

  INSERT INTO applications (tenant_id, property_id, status)
  VALUES (p_tenant_id, p_property_id, 'pending')
  ON CONFLICT (tenant_id, property_id)
  DO UPDATE SET updated_at = applications.updated_at
  RETURNING id INTO app_id;
  RETURN app_id;
END;
$$;

REVOKE ALL ON FUNCTION complete_rental_application(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION apply_to_property(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_rental_application(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION apply_to_property(UUID, UUID) TO service_role;