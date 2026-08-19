-- Private bucket for executed landlord DocuSign agreements (Equifax Broker
-- Subscriber Agreement + Plaid End Client Consent). Not public — these contain
-- business/PII details. Server (service role) writes; landlord can read their
-- own folder (path prefix = their user id) if we ever expose a download link.
INSERT INTO storage.buckets (id, name, public)
VALUES ('landlord-agreements', 'landlord-agreements', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Landlords can read own signed agreements"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'landlord-agreements'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
