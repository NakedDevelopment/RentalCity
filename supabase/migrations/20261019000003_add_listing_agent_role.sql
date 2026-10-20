-- Add a third signup role: a listing agent lists properties on behalf of landlords.
-- Treated as landlord-equivalent at the application layer (see useProfileRole.ts).
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'listing_agent';
