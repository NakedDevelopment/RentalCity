# Housing Voucher feature (eb83024d, a51ccf63, 47c3639c, 6fd5bddf)

## Investigation — already-done check (critical, verified via git log + live code)
All 4 tickets are decomposed pieces of a single approved submission ("[CODE] Housing voucher
(Section 8) support", approved by Jason 2026-10-19). Two **earlier single-task-mode runs today**
(commits `71f8c37`, `83ace79`) already built:
- DB migration (`participates_in_voucher_program`, `voucher_coverage_percentage` on
  `tenant_questionnaire`; `accepts_housing_vouchers` on `landlord_questionnaire`).
- Questionnaire UI (tenant + landlord) collecting the answers, with a `showIf` conditional-display
  mechanism.
- `server/match.ts` eligibility rule (voucher tenant ineligible for a landlord who doesn't accept
  vouchers).
- Explicitly OUT OF SCOPE in that run (confirmed via BUILD_LOG.md): Plaid-skip-at-100%-coverage,
  the shared `income_satisfied` rule, and the "Housing Voucher" badge — i.e. exactly this run's
  remaining 4 tickets' scope. No duplicate work was done.

## Ground-truth corrections (ticket text vs real code)
- The real table is `plaid_financial_verifications`, not `bank_verifications` as all 4 tickets
  state (known repo-wide drift pattern).
- `computeTenantRentScoreFromDimensions` takes **one argument only** — no `incomeVerified` second
  parameter exists anywhere in the live code, contradicting 3 tickets' claim of an "updated
  signature." The customer's own approved decision text is explicit: "Do NOT change the renter
  score — tenantRentScore.ts has no income-verification logic." Left untouched, in both call sites
  (`YourMatchesPage.tsx`, `LandlordTenantProfilePage.tsx`).
- `LandlordMatchPage.tsx` (named in 6fd5bddf as a badge surface) is a static "take the survey"
  onboarding explainer — it renders zero tenant cards. No badge placed there; this is a ticket
  text error, not a missed requirement.

## Acceptance Criteria
- AC-01 (eb83024d — Plaid skip): Given a tenant with `voucher_coverage_percentage === 100`, when
  they view `YourMatchesPage` or `RentalApplicationPage`, then the Plaid income-verification
  prompt/step never appears and their checklist shows income as satisfied.
- AC-02 (eb83024d): Given coverage < 100% or no voucher participation, then Plaid behavior is
  completely unchanged.
- AC-03 (a51ccf63): Given `GET /api/plaid/verification`, then the response includes
  `incomeSatisfied`/`incomeSatisfiedReason` computed as `plaid_financial_verifications.income_verified
  OR voucher_coverage_percentage === 100`, without writing any row to `plaid_financial_verifications`
  for the voucher path.
- AC-04 (47c3639c): Given `BankVerificationCard`/`AccountPage`/`LandlordTenantProfilePage`, then
  all three read `income_satisfied` (falling back to `income_verified`) instead of the raw Plaid
  flag, so a voucher-only tenant shows as income-verified on all three surfaces.
- AC-05 (6fd5bddf): Given a tenant who participates in the voucher program, then a "Housing
  Voucher" badge (with coverage % when known) appears on the landlord's match-catalog cards
  (`YourMatchesPage` landlord view) and the tenant's own profile page
  (`LandlordTenantProfilePage`).

## PM review
Scope narrowed per the two ground-truth corrections above (renter-score signature claim removed;
`LandlordMatchPage.tsx` dropped as a badge target). **PM APPROVED.**

## Dev
- `server/index.ts` — `verificationRow()` now always includes `incomeSatisfied`/`incomeSatisfiedReason`
  (defaulting to the Plaid signal); new `isVoucherFullyCovered()` + `withIncomeSatisfied()` helpers;
  `GET /api/plaid/verification` applies the OR-voucher override (including when there's no Plaid
  row at all — synthesizes a response-only verification object, never a DB row).
- `client/src/lib/plaidApi.ts`, `BankVerificationCard.tsx`, `AccountPage.tsx`,
  `LandlordTenantProfilePage.tsx` — all read `incomeSatisfied`/`income_satisfied` with a fallback
  to the raw Plaid flag; `AccountPage.tsx`/`LandlordTenantProfilePage.tsx` compute it client-side
  from already-fetched (or minimally extended) `tenant_questionnaire` selects rather than adding a
  new network call.
- `YourMatchesPage.tsx`, `RentalApplicationPage.tsx` — income-prompt gating and the Plaid wizard
  step now key off `incomeSatisfied`.
- `server/index.ts` `buildLandlordCatalogRows` + `LandlordCatalogRowOut` — added
  `participatesInVoucherProgram`/`voucherCoveragePercentage` to the catalog response (previously
  used only for internal eligibility scoring, never surfaced to the client).
- `YourMatchesPage.tsx` landlord card + `LandlordTenantProfilePage.tsx` header — new amber
  "Housing Voucher" badge, reusing the signup page's existing amber token (`#fff4e6`/`#c47a1e`).
