# Housing voucher (Section 8) support — questionnaire + matching

## Acceptance Criteria

AC-01: Given a landlord taking the compatibility survey, when they reach the policy questions (before "conflict handling style"), then they see "Do you accept housing vouchers?" with Yes/No choices.

AC-02: Given a landlord completes the survey with an answer to the voucher question, when `handleComplete` runs, then `landlord_questionnaire.accepts_housing_vouchers` is set to `true`/`false` matching the answer, and the raw answer is also present in the `answers` JSONB.

AC-03: Given a tenant taking the questionnaire, when they reach the end of the question list, then they see "Do you participate in a housing voucher program?" (Yes/No).

AC-04: Given a tenant answers "Yes" to the voucher-participation question, when they proceed, then a new required question "What percentage of your rent does it cover?" (25%/50%/75%/100%) appears before the income step.

AC-05: Given a tenant answers "No" (or hasn't answered) to the voucher-participation question, then the coverage-percentage question is not shown and total step count excludes it.

AC-06: Given a tenant previously answered "Yes" + a coverage percentage, when they go back and change the answer to "No", then the coverage question is removed from the flow and its stale answer is cleared from local state before save.

AC-07: Given a tenant completes the questionnaire, when `handleComplete` runs, then `tenant_questionnaire.participates_in_voucher_program` is a boolean matching the Yes/No answer, and `voucher_coverage_percentage` is the selected integer (25/50/75/100) when participating, or `null` when not.

AC-08: Given the new columns, then adding these questions does NOT change `tenantRentScore`/`scoreTenantDimensions` output — the new question ids are not referenced by any scoring dimension (score: 0 everywhere, dimension functions only look up specific known ids).

AC-09: Given a voucher tenant (`participates_in_voucher_program = true`) and a landlord with `accepts_housing_vouchers = false`, when match eligibility is computed (`computeMatch`), then the match is `eligible: false` with reason "Landlord does not accept housing vouchers." — applied in `/api/matches/for-tenant`, `/api/matches/for-landlord`, and `/api/matches/landlord-catalog` (`buildLandlordCatalogRows`).

AC-10: Given a voucher tenant and a landlord with `accepts_housing_vouchers = true` OR `accepts_housing_vouchers = null` (hasn't answered), then the voucher check does not exclude the match (other eligibility rules still apply normally).

AC-11: Given a non-voucher tenant (`participates_in_voucher_program = false`), then matching behavior is completely unchanged regardless of landlord's voucher answer.

AC-12: Given the DB connection, then the migration `20261019000001_add_housing_voucher_fields.sql` is additive only (ADD COLUMN IF NOT EXISTS) and has been applied to the live Supabase DB (verified via psql).

AC-13 (out of scope, verify untouched): `client/src/lib/tenantRentScore.ts` and the renter score displayed to users are unchanged by this task. Plaid-skip, the shared income rule, and voucher badges are explicitly out of scope per the approved implementation prompt.

## PM Review

Reviewed against task description and Implementation Prompt (final, approved by Jason 2026-10-19). ACs cover the required storage decision (JSONB + dedicated columns), both questionnaires, conditional display support (new, minimal — `showIf` field), server-side matching in all 3 match endpoints (symmetric via shared `computeMatch`), and explicit non-regression of tenant scoring and out-of-scope items.

**PM APPROVED — proceed to development** (already built; this AC set is used for QA verification below).
