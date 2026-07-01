---
name: Stripe fee model & membership gating
description: Rental City's authoritative fee structure and where each fee is enforced (UI vs server vs RLS).
---

# Rental City Stripe fees — decisions

Authoritative fee model (client-confirmed):
- Tenant application fee: flat **$50**, one-time, valid 6 months (replaced old $125 new / $50 renewal).
- Landlord **$200** one-time to VIEW a tenant's FULL profile (background/credit), Stripe Checkout `mode: payment`, per-application.
- Landlord **$350/year AUTO-RENEWING** subscription (`mode: subscription`), required to publish listings.

## Where each fee is enforced
- All three flows: client redirects to Stripe Checkout, then a **return-from-Stripe confirm effect** reads `?...=success&session_id=...` (and `=cancel`), POSTs to the matching `/confirm` endpoint, then strips the query params via `navigate(..., {replace:true})`. Confirm endpoints are server-authoritative (auth + session metadata owner check + amount check + idempotency).

## Membership gate — two layers (important)
**Why two layers:** the UI gate alone is bypassable (direct Supabase writes skip the Express API).
- **UI layer:** membership gate lives on the onboarding **property-intro** page, NOT at publish. Chosen so the Stripe redirect doesn't destroy in-memory photo `File` objects held in the add-property draft flow.
- **Server-authoritative layer:** properties are published via a **direct Supabase insert/update** (`status='active'`), so the only enforceable boundary is **RLS**. A `SECURITY DEFINER` function `public.landlord_has_active_membership()` gates the properties INSERT/UPDATE policies: a row may be/stay `active` only with an active, unexpired membership. Drafts (`status <> 'active'`) are unrestricted.
- **Consequence (intentional):** because UPDATE `WITH CHECK` inspects the resulting row, a lapsed member cannot edit/keep an active listing until they renew — consistent with the $350/yr "to list" model.

## Environment quirks
- The restricted Stripe **TEST** key CAN create subscription-mode Checkout sessions (verified) — no key swap needed for subscriptions.
- Stripe SDK v17: `Subscription.current_period_end` is at the **top level** (not nested under items).
