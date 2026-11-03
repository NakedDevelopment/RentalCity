-- Phase 1 tenant leases. Additive: new table, indexes, and a private storage
-- bucket. Does not change profiles DocuSign columns, applications, or
-- properties.lease_term. Service role writes PDFs and rows. RLS is on with no
-- policies, so the Data API cannot read another tenant's lease. Downloads go
-- through the authenticated Express API.

CREATE TABLE IF NOT EXISTS public.leases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  application_id uuid REFERENCES public.applications (id) ON DELETE SET NULL,
  original_storage_path text NOT NULL,
  signed_storage_path text,
  envelope_id text,
  envelope_status text NOT NULL,
  sent_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leases_tenant_id_idx ON public.leases (tenant_id);
CREATE INDEX IF NOT EXISTS leases_landlord_property_idx ON public.leases (landlord_id, property_id);
CREATE INDEX IF NOT EXISTS leases_envelope_id_idx ON public.leases (envelope_id) WHERE envelope_id IS NOT NULL;

-- One in-progress lease per landlord + tenant + property. Completed, declined,
-- and voided rows stay as history.
CREATE UNIQUE INDEX IF NOT EXISTS leases_one_open_per_party
  ON public.leases (landlord_id, tenant_id, property_id)
  WHERE envelope_status NOT IN ('completed', 'declined', 'voided');

ALTER TABLE public.leases ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.leases FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leases TO service_role;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('leases', 'leases', false, 8388608, ARRAY['application/pdf']::text[])
ON CONFLICT (id) DO NOTHING;
