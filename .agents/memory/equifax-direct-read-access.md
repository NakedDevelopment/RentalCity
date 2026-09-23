---
name: Equifax direct-read access
description: Keeping direct Supabase reads aligned with server-side Equifax approval gates.
---

When changing who may view Equifax screening results, inspect the active database policies rather than relying on older migration names. Apply the same current-agreement and approval requirements to direct browser reads as to server endpoints. Keep Plaid bank verification separate if the change is specific to Equifax screening.

**Why:** A prior screening table and policy were renamed; an update aimed at the old name could silently skip the live background-check policy, leaving historical approval sufficient for direct reads even when API checks correctly denied access.

**How to apply:** Check live `pg_policies` for every screening table, preserve the per-tenant unlock requirement, and verify the resulting policy definition after migration. Do not infer effective protection from API routes alone.