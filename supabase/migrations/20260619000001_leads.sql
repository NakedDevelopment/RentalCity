-- Marketing leads captured from the standalone "Rental Value Report" lead magnet.
-- These are NOT RentalCity users (they have no profiles row); they are inbound
-- prospects, segmented by `source`. Access is server-only via the service role.

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL DEFAULT 'rental_value_report',
  email TEXT,
  address TEXT NOT NULL,
  property_type TEXT,
  bedrooms NUMERIC,
  bathrooms NUMERIC,
  square_footage INTEGER,
  rent INTEGER,
  rent_range_low INTEGER,
  rent_range_high INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS leads_source_created_at_idx ON public.leads (source, created_at DESC);
CREATE INDEX IF NOT EXISTS leads_email_idx ON public.leads (email);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: leads are marketing prospects, not app users. Only
-- the service role (the Express server / admin endpoints) may read or write them;
-- the anon/auth Supabase clients can never see this table.
