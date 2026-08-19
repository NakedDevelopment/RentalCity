-- Gate landlord read access to tenant Plaid data and background-check screenings
-- behind BOTH landlord DocuSign agreements: Equifax approval (external, ~24h) and
-- the Plaid End Client Consent (self-serve, no external approval).
--
-- The existing "matched tenant" logic (application / message thread / rating /
-- invite restriction) is unchanged — this adds an additional AND requirement.

ALTER POLICY "Landlords can read plaid verification for matched tenants"
  ON plaid_financial_verifications
  USING (
    (
      EXISTS (
        SELECT 1 FROM applications a JOIN properties p ON p.id = a.property_id
        WHERE a.tenant_id = plaid_financial_verifications.user_id AND p.landlord_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM message_threads mt
        WHERE mt.tenant_id = plaid_financial_verifications.user_id AND mt.landlord_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM tenant_ratings tr
        WHERE tr.landlord_id = auth.uid()
          AND (tr.tenant_external_id = (plaid_financial_verifications.user_id)::text
               OR (tr.tenant_id IS NOT NULL AND tr.tenant_id = plaid_financial_verifications.user_id))
      )
      OR EXISTS (
        SELECT 1 FROM tenant_invite_restrictions tir
        WHERE tir.tenant_id = plaid_financial_verifications.user_id AND tir.landlord_id = auth.uid() AND tir.ends_at > now()
      )
    )
    AND EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.equifax_approved_at IS NOT NULL
        AND pr.plaid_agreement_signed_at IS NOT NULL
    )
  );

ALTER POLICY "Landlords can read universal application screenings for matched"
  ON universal_application_screenings
  USING (
    (
      EXISTS (
        SELECT 1 FROM applications a JOIN properties p ON p.id = a.property_id
        WHERE a.tenant_id = universal_application_screenings.tenant_id AND p.landlord_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM message_threads mt
        WHERE mt.tenant_id = universal_application_screenings.tenant_id AND mt.landlord_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM tenant_ratings tr
        WHERE tr.landlord_id = auth.uid()
          AND (tr.tenant_external_id = (universal_application_screenings.tenant_id)::text
               OR (tr.tenant_id IS NOT NULL AND tr.tenant_id = universal_application_screenings.tenant_id))
      )
      OR EXISTS (
        SELECT 1 FROM tenant_invite_restrictions tir
        WHERE tir.tenant_id = universal_application_screenings.tenant_id AND tir.landlord_id = auth.uid() AND tir.ends_at > now()
      )
    )
    AND EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.equifax_approved_at IS NOT NULL
        AND pr.plaid_agreement_signed_at IS NOT NULL
    )
  );
