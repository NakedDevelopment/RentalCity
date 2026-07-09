-- Track which lifecycle emails have been sent to each landlord so we never
-- send the same one twice. Written only by the server (service role).
CREATE TABLE IF NOT EXISTS landlord_lifecycle_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('all_uploaded', 'partial_upload', 'upload_reminder')),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (landlord_id, kind)
);

ALTER TABLE landlord_lifecycle_emails ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (server) reads/writes this table.
