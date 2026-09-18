-- Track the two IDS products independently. This preserves a successful,
-- potentially billable result when the other product fails and gives pending
-- orders a durable reference for GetResults polling.

ALTER TABLE equifax_background_checks
  ADD COLUMN IF NOT EXISTS criminal_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS eviction_status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS criminal_reference_id TEXT,
  ADD COLUMN IF NOT EXISTS eviction_reference_id TEXT;

ALTER TABLE equifax_background_checks
  DROP CONSTRAINT IF EXISTS equifax_background_checks_criminal_status_check,
  DROP CONSTRAINT IF EXISTS equifax_background_checks_eviction_status_check;

ALTER TABLE equifax_background_checks
  ADD CONSTRAINT equifax_background_checks_criminal_status_check
    CHECK (criminal_status IN ('not_started', 'pending', 'complete', 'failed')),
  ADD CONSTRAINT equifax_background_checks_eviction_status_check
    CHECK (eviction_status IN ('not_started', 'pending', 'complete', 'failed'));

-- Preserve any result already computed by the original combined flow.
UPDATE equifax_background_checks
SET
  criminal_status = CASE
    WHEN criminal_pass IS NOT NULL THEN 'complete'
    WHEN status = 'pending' THEN 'pending'
    WHEN status = 'failed' THEN 'failed'
    ELSE criminal_status
  END,
  eviction_status = CASE
    WHEN eviction_pass IS NOT NULL THEN 'complete'
    WHEN status = 'pending' THEN 'pending'
    WHEN status = 'failed' THEN 'failed'
    ELSE eviction_status
  END;