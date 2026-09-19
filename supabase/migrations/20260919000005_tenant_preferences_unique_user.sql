-- The application treats tenant_preferences as one row per tenant and uses
-- user_id as the upsert conflict target. A normal index is insufficient for
-- ON CONFLICT; PostgreSQL requires a unique constraint or unique index.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.tenant_preferences'::regclass
      AND conname = 'tenant_preferences_user_id_key'
  ) THEN
    ALTER TABLE public.tenant_preferences
      ADD CONSTRAINT tenant_preferences_user_id_key UNIQUE (user_id);
  END IF;
END
$$;