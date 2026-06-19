---
name: Rental City database access
description: Which DB the app uses vs. which the agent SQL tools hit, and how to inspect real app data.
---

# Database access (Rental City)

The app's real database is **Supabase**. The server reads `VITE_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`; one-off migrations are applied with `npm run db:apply-sql -- <file>` (uses `SUPABASE_DB_URL`).

The `executeSql` / `checkDatabase` agent tools and the built-in `database` skill talk to the **Replit-managed Postgres** (`DATABASE_URL` / `PG*` secrets) — a DIFFERENT, mostly-empty database. Querying app tables there returns `relation "..." does not exist` even when the row exists in Supabase.

**How to apply:** To inspect real app data, connect to Supabase with `pg` via `process.env.SUPABASE_DB_URL` (e.g. an inline `node -e` script) — never print the connection string. Do NOT trust `executeSql`/`checkDatabase` for app data.

**Why:** lost a step seeing `relation "public.leads" does not exist` from `executeSql` although the lead row was present in Supabase.
