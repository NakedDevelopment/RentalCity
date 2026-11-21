-- Additive funnel events for tenant sign-up and application steps.
-- New table only. Does not alter existing tables, columns, views, functions, policies, or data.
-- Rows store a step name, timestamp, user type, and either an internal user id or an anonymous id.

CREATE TABLE public.funnel_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  step text NOT NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  user_type text NOT NULL,
  user_id uuid,
  anonymous_id text,
  CONSTRAINT funnel_events_step_len CHECK (char_length(step) BETWEEN 1 AND 80),
  CONSTRAINT funnel_events_user_type_check CHECK (user_type IN ('tenant', 'landlord')),
  CONSTRAINT funnel_events_anonymous_id_len CHECK (anonymous_id IS NULL OR char_length(anonymous_id) <= 64),
  CONSTRAINT funnel_events_identity_check CHECK (
    (user_id IS NOT NULL AND anonymous_id IS NULL)
    OR (user_id IS NULL AND anonymous_id IS NOT NULL)
  )
);

CREATE INDEX funnel_events_user_type_step_idx ON public.funnel_events (user_type, step);

ALTER TABLE public.funnel_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.funnel_events FROM PUBLIC, anon, authenticated;
GRANT INSERT ON public.funnel_events TO anon;
GRANT INSERT, SELECT ON public.funnel_events TO authenticated;
GRANT ALL ON public.funnel_events TO service_role;

-- Signed-in tenants may insert only their own tenant events.
CREATE POLICY funnel_events_insert_own ON public.funnel_events
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_type = 'tenant'
    AND user_id = auth.uid()
    AND anonymous_id IS NULL
  );

-- Before auth, a tenant event may carry an anonymous id and no user id.
CREATE POLICY funnel_events_insert_anonymous ON public.funnel_events
  FOR INSERT
  TO anon
  WITH CHECK (
    user_type = 'tenant'
    AND user_id IS NULL
    AND anonymous_id IS NOT NULL
  );

-- Admins are the only readers. is_admin() is the existing helper; this policy does not change it.
CREATE POLICY funnel_events_select_admin ON public.funnel_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
