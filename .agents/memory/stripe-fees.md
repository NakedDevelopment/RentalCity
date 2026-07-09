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

## Demo payment bypass (no publishable key)
**Why:** allow click-through demos when the Stripe *publishable* (client) key is unavailable — embedded checkout can't render without it. (Server test key IS present, so real test-mode checkout still works when a pk is added.)
**Non-negotiable policy:** the bypass must be OFF by default and can NEVER run in production. Enforced by a two-part gate — `NODE_ENV !== 'production'` in code AND the enabling flag scoped to the **development** environment only. Do not set the flag in shared/production scope.
**Decision:** demo grants entitlements by reusing the exact `/confirm` fulfillment helpers (never a parallel code path), so demo access == paid access. Trade-off accepted: demo uses fresh synthetic payment ids per click, so it is NOT idempotent across repeated clicks (extra rows / re-opened windows) — fine for dev-only demos, do not rely on it for parity testing.

## Launch promo: 6-month free trial (added July 2026)
- Landlord membership checkout now sets `subscription_data.trial_period_days = 183` (~6 months) — $0 due today, card on file, Stripe auto-bills $350/yr after trial.
- `mapSubscriptionStatus` treats `trialing` as `active`, so trial landlords get full access; confirm + webhook paths work without immediate payment.
- Paywall UI shows crossed-out $350/yr + highlighted FREE for 6 months ("Founding Landlord Offer") with auto-renewal disclosure under the CTA.
