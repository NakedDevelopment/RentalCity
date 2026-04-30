-- Sitewide, non-secret copy and contact values (admin-editable, public read for app surfaces).
CREATE TABLE site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT '',
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION site_settings_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER site_settings_updated_at
  BEFORE UPDATE ON site_settings
  FOR EACH ROW
  EXECUTE FUNCTION site_settings_set_updated_at();

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "site_settings_select_public" ON site_settings
  FOR SELECT
  USING (true);

CREATE POLICY "site_settings_insert_admin" ON site_settings
  FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "site_settings_update_admin" ON site_settings
  FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

INSERT INTO site_settings (key, value, description) VALUES
  (
    'support_contact_email',
    'support@rentalcity.com',
    'Mailto target for “Contact support” and similar links.'
  ),
  (
    'support_response_time_line',
    'We typically respond within 24 hours',
    'Main line under “Response Time” on support pages.'
  ),
  (
    'support_hours_line',
    'Monday - Friday, 9 AM - 6 PM EST',
    'Secondary line under response time on support pages.'
  ),
  (
    'support_submit_success_message',
    'Support request submitted. Our team will follow up within 24 hours.',
    'Toast-style confirmation after submitting the support form.'
  )
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE site_settings IS 'Public-facing copy and contact strings; SELECT open to anon, writes restricted to admins.';
