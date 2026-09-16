---
name: Equifax credit check integration
description: Architecture and decisions for the Equifax OneView credit check flow, SSN encryption, and landlord approval gating
---

# Equifax credit check integration

## Product: Equifax OneView Consumer Credit
- Sandbox base: `https://api.sandbox.equifax.com`
- UAT/Test base: `https://api.uat.equifax.com`
- Production base: `https://api.equifax.com`
- Token endpoint: `POST /v2/oauth/token` (Basic Auth with client_id:secret, scope is always production URL)
- Credit report: `POST /business/oneview/consumer-credit/v1/reports/credit-report`
- PDF retrieval: `GET /business/oneview/consumer-credit/v1/reports/credit-report/{reportId}`

## Credentials stored as secrets
- `EQUIFAX_CLIENT_ID`, `EQUIFAX_CLIENT_SECRET` — OAuth2 credentials
- `EQUIFAX_MEMBER_NUMBER`, `EQUIFAX_SECURITY_CODE`, `EQUIFAX_CUSTOMER_CODE` — Rental City subscriber credentials in the request body
- `EQUIFAX_ENV` — `sandbox`, `uat`, or `production`
- `SSN_ENCRYPTION_KEY` — 64-char hex, 32-byte AES-256-GCM key

## UAT environment routing

Equifax dashboard applications promoted to Test use the UAT host, while the OAuth scope still references the production hostname. Keep `EQUIFAX_ENV` in secure environment configuration and do not duplicate it in `.replit` user environment settings.

**Why:** A hardcoded `.replit` value overrode the secure UAT setting, silently routed the app to Sandbox, and produced Equifax's generic “No product match found” OAuth error even though direct UAT authentication succeeded.

**How to apply:** After changing the secure environment value, restart the workflow and verify both the resolved base URL and a token-only request before running a CTEST report. Do not infer the active host from the secret editor alone.

## SSN handling
- Encrypted at rest in `tenant_credit_consent` using AES-256-GCM (`encryptSSN`/`decryptSSN` in `server/equifax.ts`)
- Format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
- Decrypted only in memory during the Equifax API call; SSN never logged or returned to clients

## Database schema (migration 20260811000001)
- `profiles`: `equifax_approved_at`, `equifax_pending_since`, `docusign_envelope_id`, `docusign_envelope_status`
- `tenant_credit_consent` (PK: tenant_id): encrypted SSN + address fields needed for Equifax pull; tenant-only RLS
- `equifax_credit_reports`: landlord_id, tenant_id, equifax_report_id, status (pending/complete/failed); service role inserts, landlord/tenant select own rows

## Server endpoints (all in server/index.ts)
- `POST /api/equifax/consent` — tenant saves SSN+address
- `GET /api/equifax/consent` — tenant checks consent status (returns hasConsent only)
- `GET /api/equifax/landlord/status` — landlord checks own approval
- `POST /api/equifax/landlord/request-approval` — marks pending + emails admin (SUPPORT_EMAIL)
- `GET /api/equifax/credit-check/:tenantId` — landlord gets report info + tenant consent status
- `POST /api/equifax/credit-check/:tenantId` — landlord triggers Equifax pull (requires approval + tenant consent)
- `GET /api/equifax/credit-check/:tenantId/pdf` — proxy PDF from Equifax with bearer token
- `PATCH /api/admin/equifax/approve/:userId` — admin approves/revokes landlord access

## UI wiring
- Tenant: `CreditConsentCard` component added to `RentalApplicationPage` between Screening and Expiration sections
- Landlord: credit check card added to `LandlordTenantProfilePage` after `BankVerificationCard`; only visible when profile is unlocked
- Admin: "Equifax Credit Access" section added to `AdminUserDetailPage` for landlord profiles (Approve/Revoke buttons)

## DocuSign onboarding rule

Landlords must sign both the Equifax Broker Subscriber Agreement and Plaid End Client Consent after membership activation and before entering the first-property workflow. Signing alone does not grant tenant-screening access.

**Why:** Property onboarding only needs proof that the required contracts were signed, while access to sensitive tenant data also requires a separate manual Equifax approval by an administrator.

**How to apply:** Treat “both agreements signed” and “screening access approved” as separate states. The landlord may add a property once both documents are signed, but their account remains pending until the admin approval timestamp exists.

## Existing-landlord reminder rule

Landlords who already have at least one property but have not signed both agreements get a skippable reminder once per login. Deferring it leaves a persistent authenticated-app banner with direct signing access.

**Why:** Existing landlords predate the onboarding gate, but they still must understand that tenant credit and background checks remain unavailable until the required agreements are signed.

**How to apply:** Keep the banner visible across landlord pages until both signatures exist. Do not block ordinary property management, and do not keep the banner merely because Equifax admin approval is still pending.

## Paid profile-unlock report handoff

A completed paid tenant-profile unlock should immediately request the Equifax credit report when the landlord is approved and the tenant has current consent. Completed reports must be offered as an explicit authenticated PDF download.

**Why:** The checkout describes credit-report access as part of the purchase; merely unlocking the page and requiring the landlord to discover a separate screening action creates a broken purchase experience.

**How to apply:** Keep the server-side uniqueness/deduplication guard so repeated Stripe returns cannot create duplicate billable pulls. If consent or approval is missing, preserve the successful profile unlock and show the unmet prerequisite instead of treating the payment as failed.

## DocuSign private-key secret formatting

DocuSign JWT key normalization must accept PEM values whose header, base64 body, and footer have been flattened onto one line, in addition to normal PEM, escaped-newline PEM, and base64-encoded PEM.

**Why:** Deployment secret storage can remove all PEM line breaks while preserving the markers; Node’s crypto decoder rejects that otherwise-valid RSA key shape.

**How to apply:** Reconstruct standard 64-character PEM body lines before RSA validation. Continue validating with Node crypto and reject non-RSA or malformed key material without logging the secret.

## DocuSign production promotion

Legacy-promoted DocuSign integrations have separate production authentication settings even though the production integration-key value can match demo. Register an RSA public key and redirect/legal URLs from the paid account's Apps and Keys editor, then grant `signature impersonation` consent to the production user.

**Why:** Demo RSA keys and redirect URLs may remain visible on the developer account without being usable in production. `no_valid_keys_or_signatures` indicates the private key has no matching production public key; `consent_required` means the key works but production-user consent is missing.

**How to apply:** Confirm the account base URI does not contain `demo`; use the paid account's API Account ID, User ID, and base URI. Verify with a token-only JWT request and a read-only account API request before creating any production envelope.
