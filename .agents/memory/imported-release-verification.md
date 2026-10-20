---
name: Imported release verification
description: Verify external automation's claims against Replit runtime integrations and the live Supabase schema.
---

Treat imported automation's passing reports as context, not proof that provider configuration works in the publishing environment.

**Why:** External automation could not access the configured Google Maps key and relied on a reported API activation. A real request from Replit instead returned REQUEST_DENIED for an inactive Geocoding API. The imported Supabase migrations, meanwhile, had already been applied to the live database. Publishing alone cannot resolve provider activation.

**How to apply:** Confirm the live database target and inspect required columns read-only rather than blindly rerunning migrations. Test provider access from the actual runtime with one public sample address. Do not run bulk address backfills until the provider probe succeeds and the data changes/API usage are authorized.

Treat this workspace's Supabase as shared live data until proven otherwise: the published frontend and workspace were verified to use the same target.

**Why:** A development browser test can otherwise create real accounts, send real notifications, or alter live listings.

**How to apply:** Use read-only checks by default. When authenticated browser verification is necessary, isolate it to disposable generated users, avoid emails and paid provider calls, and clean up only those test users.
