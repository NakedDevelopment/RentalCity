# Rental City — Fee Processing User Stories
## Tasks: 299310cc | 1cd49bfe | 6ad9cf02
## Date: 2026-07-03

---

## Epic

Implement three fee collection flows using Stripe:
1. $50 tenant screening fee — collected before application submission
2. $200 placement fee — triggered on landlord acceptance of a tenant application
3. $350 annual landlord membership fee — charged on landlord account activation/renewal

---

## Acceptance Criteria

### $50 Tenant Screening Fee (Task 299310cc)

**AC-01:** Given a tenant with an active universal application clicks "Apply Now" on a match,
when the click is handled, then they are routed to /applications/form?propertyId=<id> instead
of directly inserting an application row.

**AC-02:** Given a tenant is on the ApplicationFormPage, when the page loads,
then a clear $50.00 Application/Screening Fee disclosure is shown before the payment step.

**AC-03:** Given a tenant clicks "Proceed to Payment", when POST /api/payments/screening-intent
succeeds, then the client receives a Stripe clientSecret and advances to the payment step.

**AC-04:** Given a confirmed Stripe PaymentIntent (status: succeeded), when the tenant submits
via POST /api/applications/submit, then the application row is inserted and the payment is
recorded in the payments table with stripe_payment_intent_id set.

**AC-05:** Given STRIPE_SECRET_KEY is not set, when any payment endpoint is called,
then a 503 is returned with a clear "not configured" message — the server does not crash.

**AC-06:** Given payment is not yet confirmed (status !== 'succeeded'), when /api/applications/submit
is called, then a 402 Payment Required response is returned.

**AC-07:** Given a duplicate application attempt (same tenant + property), when /api/applications/submit
is called, then a 409 Conflict is returned without error.

### $200 Placement Fee (Task 1cd49bfe)

**AC-08:** Given a landlord accepts a tenant application via POST /api/applications/:id/accept,
when the endpoint is called, then a Stripe PaymentIntent for $200 is created and the application
status is updated to 'approved'.

**AC-09:** Given a non-landlord (or landlord for a different property) calls the accept endpoint,
when the request is processed, then a 403 Forbidden is returned.

**AC-10:** PLACEHOLDER — Confirm with PM which party is charged: the current implementation
charges the LANDLORD. This must be confirmed before activating real Stripe card collection.

### $350 Annual Landlord Fee (Task 6ad9cf02)

**AC-11:** Given a landlord calls POST /api/landlord/subscribe-annual, when the endpoint succeeds,
then a Stripe PaymentIntent for $350 is created and a pending payment row is inserted.

**AC-12:** Given a non-landlord calls /api/landlord/subscribe-annual, then a 403 Forbidden is returned.

**AC-13:** Given Stripe fires a payment_intent.succeeded webhook for type=annual_landlord_fee,
when the webhook is processed, then profiles.landlord_membership_expires_at is set to 1 year from now.

**AC-14:** Given Stripe fires a payment_intent.payment_failed webhook, when processed,
then the payment row status is updated to 'failed'.

### DB Migration (additive)

**AC-15:** Migration 20260703000001_fee_processing.sql adds landlord_membership_expires_at column
to profiles (nullable TIMESTAMPTZ) and two indexes — all additive, no breaking changes.

---

## Instance A focused on: AC-01 through AC-08 (happy path + payment flows)
## Instance B focused on: AC-05, AC-06, AC-07, AC-09, AC-12, AC-13, AC-14 (errors + edge cases)
## Reconciler: All 15 ACs merged. AC-10 flagged as [single instance — verify with PM].

## Open PLACEHOLDERs requiring human action:
- Install @stripe/stripe-js and @stripe/react-stripe-js for real card collection
- Set VITE_STRIPE_PUBLISHABLE_KEY in client environment
- Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in server environment
- Register /api/webhooks/stripe in Stripe Dashboard
- Confirm placement fee payer (landlord vs tenant) — AC-10
- Run DB migration once Supabase credentials are available
