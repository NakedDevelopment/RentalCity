-- Remember that a tenant dismissed the one-time income-verification prompt so
-- it does not reappear on another browser or device.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS income_verification_prompt_dismissed_at TIMESTAMPTZ;