---
name: Equifax credit check integration
description: Architecture and decisions for the Equifax OneView credit check flow, SSN encryption, and landlord approval gating
---

# Equifax credit check integration

## Product: Equifax OneView Consumer Credit
- Sandbox base: `https://api.sandbox.equifax.com`
- Token endpoint: `POST /v2/oauth/token` (Basic Auth with client_id:secret, scope is always production URL)
- Credit report: `POST /business/oneview/consumer-credit/v1/reports/credit-report`
- PDF retrieval: `GET /business/oneview/consumer-credit/v1/reports/credit-report/{reportId}`

## Credentials stored as env vars
- `EQUIFAX_CLIENT_ID`, `EQUIFAX_CLIENT_SECRET` — OAuth2 credentials
- `EQUIFAX_MEMBER_NUMBER`, `EQUIFAX_SECURITY_CODE`, `EQUIFAX_CUSTOMER_CODE` — Rental City subscriber credentials in the request body
- `EQUIFAX_ENV` — `sandbox` or `production`
- `SSN_ENCRYPTION_KEY` — 64-char hex, 32-byte AES-256-GCM key

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

## DocuSign — PENDING
- Jason has a DocuSign account but hasn't set up API access yet
- Agreement template: `attached_assets/RENTAL_CITY_INC_-_Broker_Subcriber_Agreement_(Execution_7.10.docx`
- Delivery email: michael.lucre@equifax.com
- Current workaround: landlord clicks "Get Approved" → marks pending in DB → admin approves manually via admin panel

**Why:** Equifax requires each landlord to sign a Broker Subscriber Agreement before accessing credit data. This is gated in the app by `equifax_approved_at` on the profile. DocuSign automates the signing but isn't blocking — admin can approve manually until DocuSign is wired up.
