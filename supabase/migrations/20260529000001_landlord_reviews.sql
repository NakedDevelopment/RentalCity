-- Tenant -> landlord experience reviews.
-- Backs the "Leave a Review" CTA on the tenant Application Details screen so the
-- CTA can be hidden once a review has actually been submitted.

CREATE TABLE IF NOT EXISTS landlord_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES properties(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(application_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_landlord_reviews_landlord ON landlord_reviews(landlord_id);
CREATE INDEX IF NOT EXISTS idx_landlord_reviews_tenant ON landlord_reviews(tenant_id);

ALTER TABLE landlord_reviews ENABLE ROW LEVEL SECURITY;

-- Tenant (author) and the reviewed landlord can read the review.
DROP POLICY IF EXISTS "landlord_reviews_select_participants" ON landlord_reviews;
CREATE POLICY "landlord_reviews_select_participants"
ON landlord_reviews FOR SELECT TO authenticated
USING (tenant_id = auth.uid() OR landlord_id = auth.uid());

-- Only the tenant can create a review, and only for one of their own
-- applications, with landlord_id pinned to that application's property landlord.
-- This prevents a client from forging arbitrary application/landlord pairings.
DROP POLICY IF EXISTS "landlord_reviews_insert_own" ON landlord_reviews;
CREATE POLICY "landlord_reviews_insert_own"
ON landlord_reviews FOR INSERT TO authenticated
WITH CHECK (
  tenant_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM applications a
    JOIN properties p ON p.id = a.property_id
    WHERE a.id = landlord_reviews.application_id
      AND a.tenant_id = auth.uid()
      AND a.status = 'approved'
      AND p.landlord_id = landlord_reviews.landlord_id
      AND (landlord_reviews.property_id IS NULL OR landlord_reviews.property_id = a.property_id)
  )
);

-- Only the tenant can edit their own review, under the same integrity rules.
DROP POLICY IF EXISTS "landlord_reviews_update_own" ON landlord_reviews;
CREATE POLICY "landlord_reviews_update_own"
ON landlord_reviews FOR UPDATE TO authenticated
USING (tenant_id = auth.uid())
WITH CHECK (
  tenant_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM applications a
    JOIN properties p ON p.id = a.property_id
    WHERE a.id = landlord_reviews.application_id
      AND a.tenant_id = auth.uid()
      AND a.status = 'approved'
      AND p.landlord_id = landlord_reviews.landlord_id
      AND (landlord_reviews.property_id IS NULL OR landlord_reviews.property_id = a.property_id)
  )
);

-- Only the tenant can delete their own review.
DROP POLICY IF EXISTS "landlord_reviews_delete_own" ON landlord_reviews;
CREATE POLICY "landlord_reviews_delete_own"
ON landlord_reviews FOR DELETE TO authenticated
USING (tenant_id = auth.uid());
