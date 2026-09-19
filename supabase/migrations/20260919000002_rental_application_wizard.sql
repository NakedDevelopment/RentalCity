-- Persistent tenant details used to pre-fill the rental application wizard.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_of_birth DATE,
  ADD COLUMN IF NOT EXISTS address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS state TEXT,
  ADD COLUMN IF NOT EXISTS postal_code TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship TEXT,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;

-- A paid application is not complete until the required wizard steps pass.
-- triggering_property_id survives Stripe and is used exactly once on completion.
ALTER TABLE universal_applications
  ADD COLUMN IF NOT EXISTS wizard_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS triggering_property_id UUID REFERENCES properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_universal_applications_triggering_property
  ON universal_applications(triggering_property_id)
  WHERE triggering_property_id IS NOT NULL;