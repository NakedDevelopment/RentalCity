-- Align reports RLS with product: only the messaging counterpart can be reported
-- (matches Messages → Report user). Any signed-in thread participant may file the report.

DROP POLICY IF EXISTS "Landlords can create reports" ON reports;
DROP POLICY IF EXISTS "Landlords can read own reports" ON reports;

CREATE POLICY "Users can report messaging counterpart" ON reports
  FOR INSERT
  WITH CHECK (
    reporter_id = auth.uid()
    AND reported_user_id IS DISTINCT FROM auth.uid()
    AND EXISTS (
      SELECT 1
      FROM message_threads mt
      WHERE (mt.tenant_id = auth.uid() AND mt.landlord_id = reported_user_id)
         OR (mt.landlord_id = auth.uid() AND mt.tenant_id = reported_user_id)
    )
  );

CREATE POLICY "Users can read own submitted reports" ON reports
  FOR SELECT
  USING (reporter_id = auth.uid());

COMMENT ON TABLE reports IS
  'Safety reports filed from Messages → Report user. Reporter and reported user must share a message thread (tenant/landlord pair). Admins review in Issues.';

COMMENT ON TABLE support_requests IS
  'Help / product support tickets from signed-in users via /support and Account settings → Support.';
