---
name: Stripe integration approach
description: Why Rental City uses a direct Stripe Checkout integration instead of stripe-replit-sync, and the conventions to keep when extending payments.
---

# Stripe integration (Rental City)

This project does NOT use the Stripe skill's `stripe-replit-sync` machinery (stripe schema, managed webhooks, syncBackfill, product catalog).

**Why:**
- The app's database is Supabase, not a Replit Postgres / `DATABASE_URL` instance that `stripe-replit-sync` (`runMigrations`/`getStripeSync`) requires.
- The user provided **restricted API keys directly** (not the Replit Stripe OAuth connection). The restricted key lacks the broad scopes + Webhook-Endpoint write that managed webhooks/backfill need.
- The only charge is a single fixed one-time fee, so there is no catalog to sync.

**How it works:**
- Keys: `STRIPE_API_KEY_TEST` (rk_test_, dev) and `STRIPE_API_KEY` (rk_live_, prod). `getStripe()` in `server/index.ts` picks test when `NODE_ENV !== 'production'`, live otherwise, each falling back to the other.
- Hosted Stripe Checkout (redirect via `session.url`); no publishable key needed. Fee is sent with inline `price_data` (intentional deviation from the skill's "never use price_data" rule, which only applies to synced catalog products).
- Activation is idempotent, keyed on `payments.stripe_payment_intent_id` (UNIQUE). Confirm-on-return is the primary path in dev; the `/api/stripe/webhook` handler is a production backstop that no-ops until `STRIPE_WEBHOOK_SECRET` is set.
- `confirm` and `webhook` BOTH must validate `metadata.kind === 'universal_application'` AND that `amount_total` is in `UNIVERSAL_APP_FEE_CENTS` ([5000, 12500]) before activating — otherwise an unrelated paid session in the same account could trigger activation.
- Activation self-heals: if a payment row exists but no active window, it opens one (paid tenants are never stranded). True atomicity isn't possible via supabase-js without an RPC.

**Apply when:** adding any new Stripe charge (e.g. landlord match-unlock). Reuse `getStripe()`, the kind+amount validation pattern, and PaymentIntent-keyed idempotency. Live testing on a restricted key is impractical (Stripe test cards are rejected on live keys; refunds keep the processing fee) — always use the test key with card 4242 4242 4242 4242.
