ALTER TABLE tenant_application_profiles
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS idx_tenant_application_profiles_location
  ON tenant_application_profiles USING btree (lat, lng);
