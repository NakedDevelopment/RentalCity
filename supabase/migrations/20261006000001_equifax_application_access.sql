-- A previously approved v2 landlord retains credit/background access while
-- signing the expanded package. New approvals are v3 and require the completed
-- application envelope. Revocation still clears the approval timestamp.
ALTER POLICY "Landlords can read equifax background checks for unlocked tenants"
  ON equifax_background_checks
  USING (
    EXISTS (
      SELECT 1 FROM public.applications a
      JOIN public.properties p ON p.id = a.property_id
      WHERE a.tenant_id = equifax_background_checks.tenant_id
        AND p.landlord_id = auth.uid()
        AND (a.status IN ('approved', 'rejected') OR (a.status = 'pending' AND a.unlocked_at IS NOT NULL))
    )
    AND EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.equifax_approved_at IS NOT NULL
        AND pr.plaid_agreement_signed_at IS NOT NULL
        AND (
          pr.equifax_approved_version = 2
          OR (
            pr.equifax_approved_version = 3
            AND pr.equifax_agreement_version = 3
            AND pr.docusign_envelope_status = 'completed'
          )
        )
    )
  );

-- This optional table is not present on all project installations.
DO $$
BEGIN
  IF to_regclass('public.universal_application_screenings') IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'universal_application_screenings'
        AND policyname = 'Landlords can read universal application screenings for matched'
    ) THEN
    EXECUTE $policy$ALTER POLICY "Landlords can read universal application screenings for matched"
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
            WHERE tir.tenant_id = universal_application_screenings.tenant_id
              AND tir.landlord_id = auth.uid() AND tir.ends_at > now()
          )
        )
        AND EXISTS (
          SELECT 1 FROM profiles pr
          WHERE pr.id = auth.uid()
            AND pr.equifax_approved_at IS NOT NULL
            AND pr.plaid_agreement_signed_at IS NOT NULL
            AND (
              pr.equifax_approved_version = 2
              OR (
                pr.equifax_approved_version = 3
                AND pr.equifax_agreement_version = 3
                AND pr.docusign_envelope_status = 'completed'
              )
            )
        )
      )$policy$;
  END IF;
END $$;
