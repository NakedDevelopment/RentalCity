-- Additive store for listing tour requests. Used for the hourly cap and
-- duplicate-submit guard. New table only: no changes to existing tables,
-- columns, functions, policies, or data. Contact details only.

CREATE TABLE IF NOT EXISTS public.listing_tour_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_email text NOT NULL,
  tenant_name text NOT NULL,
  tenant_phone text,
  preferred_time text,
  message text NOT NULL,
  dedupe_key text NOT NULL,
  hour_bucket timestamptz NOT NULL,
  slot smallint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT listing_tour_requests_email_len CHECK (char_length(tenant_email) BETWEEN 3 AND 200),
  CONSTRAINT listing_tour_requests_name_len CHECK (char_length(tenant_name) BETWEEN 1 AND 120),
  CONSTRAINT listing_tour_requests_phone_len CHECK (tenant_phone IS NULL OR char_length(tenant_phone) BETWEEN 1 AND 40),
  CONSTRAINT listing_tour_requests_preferred_len CHECK (preferred_time IS NULL OR char_length(preferred_time) BETWEEN 1 AND 120),
  CONSTRAINT listing_tour_requests_message_len CHECK (char_length(message) BETWEEN 1 AND 2000),
  CONSTRAINT listing_tour_requests_slot_range CHECK (slot BETWEEN 1 AND 3)
);

CREATE UNIQUE INDEX IF NOT EXISTS listing_tour_requests_dedupe_key_unique
  ON public.listing_tour_requests (property_id, dedupe_key);

CREATE UNIQUE INDEX IF NOT EXISTS listing_tour_requests_slot_unique
  ON public.listing_tour_requests (property_id, tenant_id, hour_bucket, slot);

CREATE INDEX IF NOT EXISTS listing_tour_requests_property_created_idx
  ON public.listing_tour_requests (property_id, created_at DESC);

ALTER TABLE public.listing_tour_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.listing_tour_requests FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.listing_tour_requests TO service_role;
