-- Preserve the existing per-tenant unlock requirement while requiring Equifax
-- acceptance of the corrected agreement for direct browser reads.
ALTER POLICY "Landlords can read equifax background checks for unlocked tenants"
  ON equifax_background_checks
  USING (
    EXISTS (
      SELECT 1
      FROM public.applications a
      JOIN public.properties p ON p.id = a.property_id
      WHERE a.tenant_id = equifax_background_checks.tenant_id
        AND p.landlord_id = auth.uid()
        AND (a.status IN ('approved', 'rejected') OR (a.status = 'pending' AND a.unlocked_at IS NOT NULL))
    )
    AND EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.equifax_approved_at IS NOT NULL
        AND pr.equifax_approved_version = 2
        AND pr.equifax_agreement_version = 2
        AND pr.docusign_envelope_status = 'completed'
        AND pr.plaid_agreement_signed_at IS NOT NULL
    )
  );