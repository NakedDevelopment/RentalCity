-- Additive link from a pre-auth anonymous id to the signed-in user.
-- New table only. Does not alter existing tables, columns, views, functions, policies, or data.
-- Rows store an anonymous id, an internal user id, a user type, and a timestamp.

CREATE TABLE public.funnel_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anonymous_id text NOT NULL,
  user_id uuid NOT NULL,
  user_type text NOT NULL,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT funnel_identity_links_user_type_check CHECK (user_type IN ('tenant', 'landlord')),
  CONSTRAINT funnel_identity_links_anonymous_id_len CHECK (char_length(anonymous_id) BETWEEN 1 AND 64),
  CONSTRAINT funnel_identity_links_anonymous_id_key UNIQUE (anonymous_id)
);

CREATE INDEX funnel_identity_links_user_type_linked_at_idx
  ON public.funnel_identity_links (user_type, linked_at, id);

ALTER TABLE public.funnel_identity_links ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.funnel_identity_links FROM PUBLIC, anon, authenticated;
GRANT INSERT, SELECT ON public.funnel_identity_links TO authenticated;
GRANT ALL ON public.funnel_identity_links TO service_role;

-- A signed-in tenant may insert only their own tenant link. There is no update or delete grant.
CREATE POLICY funnel_identity_links_insert_own ON public.funnel_identity_links
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_type = 'tenant'
    AND user_id = auth.uid()
  );

-- Admins are the only readers. is_admin() is the existing helper; this policy does not change it.
CREATE POLICY funnel_identity_links_select_admin ON public.funnel_identity_links
  FOR SELECT
  TO authenticated
  USING (public.is_admin());
