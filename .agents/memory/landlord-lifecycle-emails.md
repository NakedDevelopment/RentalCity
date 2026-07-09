---
name: Landlord lifecycle emails
description: One-time onboarding emails via MailerSend — triggers, dedupe, and range thresholds.
---
Three one-time emails per landlord, deduped via `landlord_lifecycle_emails` (unique landlord_id+kind, service-role only):
- `all_uploaded` / `partial_upload`: sent when client fires POST /api/emails/landlord/property-published after publish; compared against lower bound of profiles.landlord_property_count_range (1 / 2-5 / 6-10 / 10+).
- `upload_reminder`: server sweep (60s after boot + every 6h) for landlords 24h+ old with zero properties and no prior lifecycle email; cursor-paginated by created_at to avoid starvation.
**Why:** claim-then-send with claim release on ANY failure path — this is what makes retries safe without double-sending.
**How to apply:** add new lifecycle kinds by extending the table CHECK constraint, buildLandlordLifecycleEmail, and reusing sendLandlordLifecycleEmail.
Personalization: first word of profiles.display_name, fallback "there". Provider is MailerSend (server/email.ts), best-effort, never blocks the request.
