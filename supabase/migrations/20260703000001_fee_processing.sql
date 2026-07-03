-- Fee Processing: Screening fee, Placement fee, Annual landlord membership fee
-- This migration adds the landlord_membership_expires_at column to profiles
-- and creates an index on payments.stripe_payment_intent_id for faster lookups.

-- Add landlord annual membership expiry tracking to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS landlord_membership_expires_at TIMESTAMPTZ;

-- Add index for faster payment lookups by type/payer (used by webhook handler)
CREATE INDEX IF NOT EXISTS idx_payments_payer_id ON payments(payer_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_id ON payments(stripe_payment_intent_id);

-- RLS: Allow the webhook service role to update payment status
-- (the webhook runs with service role key so no RLS policy needed for that path)

-- Allow landlords to read their own membership status from profiles
-- (existing profiles RLS policies cover this via auth.uid() = id)

COMMENT ON COLUMN profiles.landlord_membership_expires_at IS
  'Expiry timestamp of the landlord annual membership ($350/year). NULL = not yet activated or expired. Set by Stripe webhook on payment_intent.succeeded for type=annual_landlord_fee.';
