-- Plaid platform-level user id (from /user/create), reused across all of a
-- landlord/tenant's linked bank accounts. Required by the Income Verification
-- (Bank Income) product's /link/token/create call on accounts created after
-- Plaid's December 2025 User API migration.
-- 2026-09-18

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS plaid_user_id TEXT;
