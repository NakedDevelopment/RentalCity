-- Generated "Professional Rental Analysis" reports for the Rental Value Report
-- lead magnet. Each row is a fully-rendered, shareable HTML report served by the
-- Express server at GET /api/reports/:id. These belong to inbound marketing leads
-- (no profiles row), so — like public.leads — access is server-only via the
-- service role. Stored in Postgres (not on disk) because Autoscale deployments
-- have an ephemeral, multi-instance filesystem.

CREATE TABLE IF NOT EXISTS public.rental_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  html TEXT NOT NULL,
  summary JSONB,
  address TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rental_reports_created_at_idx ON public.rental_reports (created_at DESC);
CREATE INDEX IF NOT EXISTS rental_reports_email_idx ON public.rental_reports (email);

ALTER TABLE public.rental_reports ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: reports are served by the Express server using the
-- service role. The anon/auth Supabase clients can never read or write them.
