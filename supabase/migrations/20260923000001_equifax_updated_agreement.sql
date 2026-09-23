-- Existing approvals and signed PDFs remain historical records. Only a
-- version-2 agreement approved after Equifax review grants new screening access.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS equifax_agreement_version INTEGER,
  ADD COLUMN IF NOT EXISTS equifax_approved_version INTEGER;

-- profiles rows can be visible to related users. Keep subscriber contact
-- details separate and inaccessible through direct client-side Supabase reads.
CREATE TABLE IF NOT EXISTS equifax_subscriber_details (
  landlord_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  business_phone TEXT NOT NULL,
  business_address TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE equifax_subscriber_details ENABLE ROW LEVEL SECURITY;

-- Plaid bank verification keeps its existing historical approval/consent rule;
-- the updated Equifax paperwork only pauses new Equifax checks.
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

-- Some existing Supabase projects have not created this optional screenings
-- table yet. Update its policy only where both the table and policy exist.
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
        WHERE tir.tenant_id = universal_application_screenings.tenant_id AND tir.landlord_id = auth.uid() AND tir.ends_at > now()
      )
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
  )$policy$;
  END IF;
END $$;