# Build Log

## 2026-07-14 — Pulse automation run

See `USER_STORIES/RUN_2026-07-14.md` for full ACs, investigation findings, and the
already-satisfied / escalated items. Summary of actual code changes below.

### Changes
1. `client/src/pages/ResetPasswordPage.tsx` — fixed password reset getting rejected by
   Supabase: the page now gates the "update password" form behind proof of a genuine
   recovery-link visit (`type=recovery` + an actual token in the URL) and the SDK's
   `PASSWORD_RECOVERY` auth event, instead of calling `updateUser` immediately on submit
   before the recovery session existed.
2. `client/src/lib/landlordQuestionnaire.ts` — added a `"No, I would not/will not accept
   any of the above"` exclusive choice to Question 5 (`eviction_policy`) and Question 9
   (`bankruptcy_policy`), reusing the existing `exclusive: true` mechanism already proven
   on Question 3.
3. `client/src/pages/AddPropertyPreviewPage.tsx` — property-upload failures no longer show
   a raw/malformed SDK error string; Storage and Postgrest errors are normalized to
   human-readable messages, with a specific "renew your membership" message only for a
   genuine `properties`-table RLS violation (not storage errors, which use a different
   permission model).
4. `client/src/pages/LegalPage.tsx` — fixed a leftover "Shop Drop's App" copy-paste
   placeholder to read "Rental City App".
5. `.env.example` — documented `PLAID_ENV` alongside the existing Plaid credential vars.

### Motion Designer (single instance)
No new Hooked moments introduced. These are bug fixes / data additions, not new
interactions: the multi-state reset-password button label ("Verifying reset link..." /
"Link expired" / "Update Password") is informational state, not a reward moment, and per
MOTION.md's ethical guardrail, security/validation states should not carry
reward-style animation. No animation work needed or added.

### UX Auditor (single instance)
- UX-13 (Reduce Cognitive Load): reset-password button label change communicates system
  state clearly (verifying / expired / ready) rather than a bare disabled button.
- UX-07 (Color Has Jobs): new error/link text reuses the existing `text-red-500` auth-page
  convention (verified against LoginPage/ForgotPasswordPage) — no new ad hoc color.
- UX-10 (Components Behave Consistently): new questionnaire choice renders through the
  existing generic choice-list component with no special-casing, matching Question 3.
- No FAIL items found requiring escalation.

### QA — two-instance adversarial loop (reconciled)
Instance A (happy path): all ACs PASS on first draft.
Instance B (adversarial) found two real gaps in the first draft:
- ResetPasswordPage: treating any existing session / plain `SIGNED_IN` as recovery-ready
  let an already-logged-in user reach the update-password form without a real reset link,
  and a late recovery success after the 10s timeout never cleared the "link expired" state.
- AddPropertyPreviewPage: RLS-violation detection used `.code`, which Supabase Storage
  errors don't expose (they use `.statusCode`), and non-RLS insert errors were being
  over-broadly collapsed into one generic message.
Both were investigated directly against the Supabase SDK source and the live RLS
migrations (not just picking a side) and fixed. A second adversarial re-check then found
the first-round fix for the recovery-link check was still spoofable (checked only for the
guessable `type=recovery` string, not an actual token) and that the storage-403 case could
be misattributed to membership (storage bucket policy has no membership condition) —
both tightened in a second fix pass. Re-verified clean after that.

### Stress Tester (single instance)
- Double-submit protection on Save/Publish buttons (`submitting` state) confirmed intact,
  untouched by the error-message change.
- Empty/malformed error message input (`"]"`, empty string) confirmed still routes to the
  generic fallback via `looksLikeReadableMessage`.

### PM Visual Verification — two-instance loop (reconciled)
Both instances independently verified: new UI states reuse existing color tokens
(`text-red-500` on auth pages, `text-red-600` on property pages — both pre-existing,
page-family-specific conventions, not a regression), the new questionnaire choices render
through the existing generic component with zero special-casing, and no shared
"friendly error" utility exists elsewhere that this duplicates. **VERIFIED.**

### Build gate
`npx tsc --noEmit` (root, server) and `npx tsc -p client/tsconfig.json --noEmit` (client):
zero errors. `npm run build`: clean production build (client + server bundle).

### Database
No schema changes. Live Supabase verified via `psql` before starting: the
`landlord_has_active_membership()` RLS function and its migration are applied, 2 active
`landlord_memberships`, 7 active `properties`, zero rows violating the RLS invariant.

## 2026-07-15 — Pulse automation run

See `USER_STORIES/RUN_2026-07-15.md` for full ACs. Summary of actual code changes below.
One task in the Pulse backlog (`[CODE] Update lead magnet copy...`) was already implemented
in a same-day commit (`1a75c63`) by the client's own Replit Agent before this run started —
verified via `git log`/`git show` and marked done in Pulse without further code changes.

### Changes
1. `client/src/components/TenantLayout.tsx` — added a "Rental Value" nav item (landlord
   sidebar only) linking out to `https://value.gorentalcity.com/`, the existing lead-magnet
   tool. Extended the nav-item render to support external links (`<a target="_blank">`)
   alongside the existing internal `<Link>` items.
2. `client/public/rental-value-report/index.html` + `server/report-template.ts` (3 CTA
   locations: the lead-magnet result page, the report email, and the shareable report page's
   header + footer CTAs) — "List your property on Rental City" links changed from
   `https://gorentalcity.com` (bare marketing landing page) to `https://gorentalcity.com/signup`
   so clicking actually enters the (currently landlord-only) signup flow, which itself already
   routes a new landlord straight into the property-listing wizard. This single fix resolves
   both the "redirects to landing page instead of listing flow" ticket and the "bottom link
   does nothing" ticket — investigation found no literally-dead href anywhere in the lead
   magnet code; both tickets' user-visible symptom (ending up somewhere unhelpful) traced to
   this one wrong destination.
3. New `client/src/lib/featureFlags.ts` (`TENANT_SIDE_ENABLED`) + new
   `client/src/components/TenantSideComingSoon.tsx` — launch-sequencing flag. When off
   (production default), `TenantLayout.tsx` renders the coming-soon screen for any
   `profileRole === 'tenant'` user instead of the real app, for every route under it (single
   gate point, not per-page). `App.tsx` gates the two previously-public anonymous routes
   (`applications/apply`, `/invite/:token`) behind the same flag. Note: `RoleSelectionPage`
   already only offers a landlord option (separate prior change, not part of this flag) and
   `SignupPage` is already landlord-only, so no new signups can become tenants regardless of
   this flag — the flag protects the **15 existing real tenant accounts** (verified via psql)
   from reaching a broken UI once the flag is live in prod; they'll see the coming-soon screen
   instead of full lockout-with-errors.
4. `client/src/pages/YourMatchesPage.tsx` + `client/src/pages/LandlordTenantProfilePage.tsx`
   — moved "Unlock Profile" / "Approve" / "Decline" / "Undo decline" from the landlord's
   match-card list view to the match detail page. The detail page already had a fuller,
   previously-unreachable version of this UI gated behind a `?application=<id>` query param
   that the card's link never set; wiring that param through (`landlordTenantProfilePath`)
   activates it instead of duplicating logic. Also fixed `handleDecline`'s own internal
   navigate (previously dropped the `application` param, silently degrading the page to
   browse-only after declining) and added `handleUndoDecline` to the detail page (didn't
   exist there before). Deleted the four now-dead card-view handlers and their state.

### Motion Designer (single instance)
No new Hooked moments. Card→detail navigation reuses the existing page-transition/no-motion
convention; the coming-soon screen is an informational state, not a reward moment.

### UX Auditor (single instance)
- UX-02 (Hick's Law): card view now surfaces one action ("Review to unlock profile" /
  "Review to decide") instead of up to 3 buttons — status is still visible via the existing
  color-coded badge, so no information is lost, just fewer redundant CTAs per card.
- UX-14 (Accessibility): new button/link reuses the existing `min-h-[44px]` tap-target
  convention already used throughout this page and the detail page.
- No FAIL items found requiring escalation.

### QA — two-instance adversarial loop (reconciled)
Instance A (happy path): all 4 changes traced end-to-end, no breakage found.
Instance B (adversarial) found one real gap: the new `handleUndoDecline` didn't verify the
Supabase update actually affected a row before showing a "restored" state (a stale/already-
changed row would silently no-op). Fixed by adding a `.select('id')` + affected-rows check,
matching the more rigorous pattern the old (deleted) card-view approve/decline handlers used.
Instance B also flagged that `TenantInviteLandingPage` silently drops an invite token when
visited while the tenant flag is off — accepted as intentional given the ticket's explicit
"hide tenant side comprehensively" intent (acquisition flows included), not fixed further.

### Stress Tester (single instance)
- Malformed/foreign `?application=` values: rejected by the existing `APPLICATION_ID_PARAM_RE`
  regex before use — falls back to browse-only mode, no crash.
- Missing `VITE_TENANT_SIDE_ENABLED` env var: defaults to disabled in a production build,
  enabled in local `vite dev` (by `featureFlags.ts` design) — confirmed via `.env.example`.
- Rapid double-click on Approve/Decline/Undo: all three already guard on their own
  `disabled={...}` busy-state flags (pre-existing pattern, unaffected by this diff).
- IDs interpolated into new URLs (`?application=...`) all pass through `encodeURIComponent`.

### PM Visual Verification — two-instance loop (reconciled)
Both instances independently verified: `TenantSideComingSoon` reuses `TenantLayout`'s own
loading-screen background/copy convention (`bg-[#F8FAFD]`, same centered layout), the new
external nav item reuses the identical existing nav-item className with no new token, and
the consolidated card button reuses the exact `btn-primary` + `min-h-[44px]` pattern used
throughout both files. The card's status badge (unaffected by this diff) already
color-codes locked/unlocked/accepted/declined independent of the button, so consolidating
3 button variants into 1 link does not remove any at-a-glance status information.
**VERIFIED.**

### Build gate
`npx tsc --noEmit` (root) and `npx tsc -p client/tsconfig.json --noEmit` (client): zero
errors. `npm run build`: clean production build (client + server bundle).

### Database
No schema changes.

---

## Run — 2026-08-07 (Pulse automation)

Processed 4 admin-portal code_tasks (5 Pulse tickets, 2 merged as duplicates):

1. **AdminLayout redesign** (`c95e8f2e`) — `client/src/components/AdminLayout.tsx` rebuilt to
   match `TenantLayout.tsx`'s shell: sticky `h-16` header, `w-64` Lucide-icon sidebar
   (`bg-[#EEF4FE] text-[#3A7AFE]` active state), matching footer. Replaced the old hand-rolled
   inline-SVG `NavIcon` map entirely.
2. **Admin Properties browse + detail** (`ffc0465c` + `8771d7af` — merged) — Pulse had two
   overlapping tickets for the same feature (a simple read-only table vs. a fuller Zillow-style
   card grid with filters/sort/search + detail page). Built the superset (`8771d7af`'s spec)
   once and marked both done together rather than building the table first and immediately
   replacing it. New: `AdminPropertiesPage.tsx` (card grid, status/bedroom/rent filters, search,
   sort, reuses `PropertyCard` without its self-wrapping `Link` since the admin destination
   differs) + `AdminPropertyDetailPage.tsx` (read-only, works for any status, no Apply/Message
   CTAs — deliberately NOT reusing consumer `PropertyDetailsPage.tsx`, which hardcodes
   `.eq('status','active')` and has application CTAs; mirrors the existing
   admin-detail-page-separate-from-consumer pattern already set by `AdminUserDetailPage.tsx`).
   Landlord email/name joined via the existing `fetchAdminDirectory()` pattern, not a new
   server route. Routes registered at `/admin/properties` and `/admin/properties/:id`.
3. **Admin dashboard KPI cards + charts** (`a24b4370`) — `AdminDashboardPage.tsx` rewritten: 4
   KPI cards (Active Listings, Total Landlords, Open Support Requests, New Sign-ups 30d) each
   with a real Supabase count query and a working drill-down link; added `?status=`/`?role=`
   query-param read support to `AdminPropertiesPage`/`AdminUsersPage` so the drill-down links
   actually pre-filter. Added `recharts` (new dependency, ticket explicitly authorized install)
   for a 30-day sign-up trend stacked bar chart (landlord vs tenant) and a properties-by-status
   donut — brand colors only (`#3A7AFE`/`#00BBFF`/existing amber/gray tokens).
4. **Landlord phone number in Admin view** (`0113bfbc`) — schema check found `profiles.phone`
   already existed (no migration needed, contrary to the ticket's Step 2b assumption). Missing
   piece was capture-at-signup: added a Phone Number field to the landlord branch of
   `ProfileCreationPage.tsx` (the actual onboarding-after-signup step), saved via the existing
   profile-update call. Displayed in `AdminUserDetailPage.tsx` next to Email (existing users
   show "Not provided" until they update their profile — expected, per the ticket's own note).

### Motion Designer (single instance)
No new Hooked moments. This is internal admin CRUD/reporting tooling (staff-only, not a
consumer engagement surface) — none of the 12 Hooked moments meaningfully apply (no
onboarding/reward loop for admin users). Per the decision checklist's own test ("does removing
this hurt the experience? If no — remove it"), no animation was added; existing
hover/transition-colors conventions already in `adminUi.tsx` were reused as-is.

### QA — two-instance adversarial loop (reconciled)
Instance A (happy path): all Supabase queries/mutations traced to real code paths (no mock
data), routing and drill-down params wired correctly, admin-role guard intact. No FAILs.
Instance B (adversarial) found no HARD FAILs. Two soft issues investigated directly:
- `AdminPropertiesPage.tsx` renders `sqft ?? 0` as "0 Ft" for properties with a null sqft
  (reads as a real zero rather than "unknown"). Verified this matches the pre-existing
  convention already in `HomePage.tsx` (`sqft: p.sqft ?? 0`) — not a new regression, not fixed,
  since fixing it would mean changing the shared `PropertyCard` component beyond this task's
  scope.
- `status`/`role` filter state is seeded from the URL query param only at mount. Confirmed
  unreachable today (dashboard drill-down links always remount the target route under
  `AdminLayout`'s `<Outlet>`), so not a live bug — noted here as a known latent limitation if a
  future same-route query-param-only link is ever added.
Schema references (`properties.sqft/bathrooms/photo_urls/amenities/photo_labels`,
`profiles.phone`, `support_requests.status`) all verified against real migrations/live schema.

### PM Visual Verification — two-instance loop (reconciled)
Both instances independently VERIFIED. Items initially flagged by either instance (green
"Active" status badges appearing to conflict with the "no off-brand greens" redesign rule;
inline-SVG field icons on `ProfileCreationPage.tsx` instead of Lucide) were checked against
the actual codebase and confirmed to be pre-existing conventions used elsewhere in the admin
portal / that page, not new regressions. Chart colors are brand-only
(`#3A7AFE`/`#00BBFF`/existing amber/gray). `AdminPropertiesPage`'s reuse of `PropertyCard`
matches `HomePage.tsx`'s usage (same props; omits consumer-only `perfectFit`/`postedAgo`
badges, which is admin-appropriate). **VERIFIED.**

### Build gate
`npx tsc --noEmit` (root, server-only tsconfig) and `cd client && npx tsc --noEmit`: zero
errors. `npm run build`: clean production build (client + server bundle).

### Dependencies
Added `recharts` (explicitly authorized by the `a24b4370` ticket). `package-lock.json` was
regenerated via the standard workaround (Replit firewall URLs unreachable from this Mac
automation environment) and committed this time since a dependency genuinely changed.

### Database
No schema changes — `profiles.phone` already existed live; no migration needed.

## 2026-08-07 — Pulse automation run #2

See `USER_STORIES/TASK_c543e7ee.md` for full ACs and PM sign-off. One `code_task` open
this run (task `c543e7ee`), all others in the backlog are `future_feature`/`human_task`/
`incomplete` and out of scope for the strict `task_type=code_task` filter.

### Changes
1. **Redesign Admin Landlord Detail Page — Rich Profile View** (task `c543e7ee`) —
   `client/src/pages/admin/AdminUserDetailPage.tsx` rewritten from a plain text field list
   into a hero header (avatar with initial-letter fallback, display name, role badge,
   status badge) + Contact & Account Info panel (email/phone/member-since/last-seen) +
   a landlord-only Listed Properties grid (bespoke card — thumbnail, title/address,
   city/state, beds · rent, status badge — deliberately not the shared `PropertyCard`
   component, since that component requires baths/sqft props this page doesn't fetch)
   linking to the existing `AdminPropertyDetailPage`, plus a "X rented out" stat.
   `server/index.ts`'s `/api/admin/directory` route and `AdminDirectoryUser` type extended
   with `avatar_url` (from `profiles`) and `last_sign_in_at` (from `auth.users` via the
   existing `admin.auth.admin.listUsers()` call — not a public-table fabrication).
   `AdminPropertiesPage.tsx`'s shared `StatusBadge` gained a `leased` → blue variant (the
   real schema enum is `draft/active/leased/inactive`; there is no literal `'rented'`
   value) and now exports `PLACEHOLDER_IMAGES` for reuse on the new page's cards.

### QA — two-instance adversarial loop (reconciled)
Instance A (happy path): all 10 ACs traced to real code/schema, no FAILs. Flagged the
display-name fallback showing the user's email instead of the ticket's literal "—" when
`display_name` is null — fixed (`displayName`/`avatarName` now split so the header text
falls back to "—" while the avatar initial still uses the email for a sensible letter).
Instance B (adversarial) raised three items, each investigated directly rather than
picked-a-side:
- Reused `PLACEHOLDER_IMAGES` stock-photo fallback flagged as a possible mock-data
  violation — verified via `git log -p` it's a pre-existing, already-shipped, already
  ACC-passed convention from the prior run (`48d7be3`), not new. Not a HARD FAIL.
- Stale-`row`-during-fast-navigation race (switching between two landlord detail pages
  without unmount) — verified the original pre-redesign file had the identical
  no-reset-on-id-change characteristic; not a regression introduced by this diff. Documented
  as a known latent limitation, not fixed (admin-only tool, self-heals within one fetch).
- `StatusBadge`'s new `leased` bucket sharing amber styling with `inactive` undermined the
  task's own "rented out" stat — real issue, fixed by adding a distinct blue variant.

### PM Visual Verification — two-instance loop (reconciled)
Instance A and B disagreed on whether `bg-[#EEF4FE] text-[#3A7AFE]` (the landlord
role-badge color) was a typo of the `blue-50` token (`#EEF4FF`) or an established
convention — investigated directly via grep: confirmed it's a real, 5-times-repeated
sitewide convention (`AdminLayout.tsx:73,96`, `TenantLayout.tsx:146`,
`PropertiesPage.tsx:27`), so reverted an incorrect interim fix back to the exact
established hex. Both instances independently caught a real bug Instance A traced to
`tailwind.config.js`: the new `leased` badge's `text-blue-800` doesn't resolve to the
brand-remapped blue scale (only `blue.50`–`blue.700` are overridden; `800` silently falls
through to stock Tailwind navy) — fixed to `text-blue-700`. Also aligned on request:
hero avatar `h-20/w-20` → `h-16/w-16` (matches `UserMenu.tsx` and every other avatar
sitewide), property-card thumbnail `aspect-[16/9]` → `aspect-[4/3]` (matches the sibling
`AdminPropertiesPage` grid card this new card is functionally equivalent to), contact-info
grid `gap-4` → `gap-3` (matches `AdminIssuesPage`/`AdminNotificationsPage` detail-field
grids). The new bordered/colored role+status pill treatment on this page (vs.
`AdminUsersPage`'s flat gray/bare-text table styling for the same fields) was confirmed
intentional, not a regression — the ticket's entire premise is elevating this page beyond
that plain-list treatment. **VERIFIED** after fixes.

### Build gate
`npx tsc --noEmit` (root) and `cd client && npx tsc --noEmit`: zero errors, both before and
after the QA/Visual-Verification fix round. `npm run build`: clean production build.

### Dependencies
No new dependency. `package-lock.json` regenerated via the standard workaround to run the
build gate, then reverted (`git checkout -- package-lock.json`) since nothing changed.

### Database
No schema changes — all referenced columns (`profiles.avatar_url`, `properties.*`) already
existed live. `last_sign_in_at` is intentionally never queried from a public table.

## 2026-10-19 — Pulse automation run (single-task mode)

Task `b16ed2c1-1a88-4d7c-b2cc-fee3b2a3cb02`: housing voucher (Section 8) questionnaire
fields + voucher-aware matching. See `USER_STORIES/TASK_b16ed2c1-1a88-4d7c-b2cc-fee3b2a3cb02.md`
for full ACs. Decisions below were FINAL/approved by Jason per the task's Implementation
Prompt — not re-litigated.

### Changes
1. `supabase/migrations/20261019000001_add_housing_voucher_fields.sql` (new, additive,
   applied live via psql) — `landlord_questionnaire.accepts_housing_vouchers boolean`,
   `tenant_questionnaire.participates_in_voucher_program boolean`,
   `tenant_questionnaire.voucher_coverage_percentage integer`.
2. `client/src/lib/landlordQuestionnaire.ts` — new `accepts_housing_vouchers` Yes/No
   question, placed before `conflict_handling_style` per spec. Choice ids are literally
   `'yes'`/`'no'` (not the usual `'a'/'b'`) so the save-path boolean conversion is direct.
3. `client/src/lib/tenantQuestionnaire.ts` — new `participates_in_voucher_program` Yes/No
   question (score 0, does not affect renter score) and a conditional
   `voucher_coverage_percentage` follow-up (25/50/75/100, score 0) shown only when the
   prior answer is `'yes'`. Added a minimal `showIf: { questionId, equals }` field to the
   `TenantQuestion` type — the only conditional-display mechanism this questionnaire had
   before was none at all.
4. `client/src/pages/TenantQuestionnairePage.tsx` — steps now iterate a `visibleQuestions`
   array filtered by `showIf` instead of the raw `tenantQuestions` array, so `totalSteps`
   and step indexing shrink/grow automatically as the voucher-participation answer changes.
   `handleSelect` clears any dependent answer whose `showIf` condition no longer holds
   (e.g. switching voucher participation from Yes to No clears a stale coverage %).
   `handleComplete` now also writes the two dedicated columns from the JSONB answers.
5. `client/src/pages/CompatibilitySurveyPage.tsx` — `handleComplete` (landlord) now also
   writes `accepts_housing_vouchers` from the JSONB answer.
6. `server/match.ts` — `landlordAnswersToPrefs` derives `acceptsHousingVouchers` (boolean |
   null) and `tenantAnswersToHistory` derives `participatesInVoucherProgram` (boolean) from
   the raw JSONB answer strings. `computeMatch` adds one new eligibility rule: a voucher
   tenant is ineligible for a landlord with `acceptsHousingVouchers === false` (strict
   equality — `null`/unanswered landlords are NOT excluded, matching spec). Non-voucher
   tenants are completely unaffected (condition short-circuits on
   `participatesInVoucherProgram`).
7. `server/index.ts` — all three match endpoints (`/api/matches/for-tenant`,
   `/api/matches/for-landlord`, `buildLandlordCatalogRows` used by
   `/api/matches/landlord-catalog`) now `SELECT` the two new dedicated columns and merge
   them onto the prefs/history objects before calling `computeMatch`, using the same
   `dedicated-column ?? jsonb-derived-fallback` pattern already established for
   `policy_strictness_score`/`risk_tolerance_score`/`conflict_style_score`. This applies the
   rule symmetrically in both directions (tenant's matches and landlord's matches) through
   one shared function, per spec.

### Investigation note (deviation from the ticket's literal description)
The ticket's Implementation Prompt said "Server save path... Where `landlord_questionnaire`
/ `tenant_questionnaire` are written in `server/`." Investigation found this is incorrect —
both tables are written directly from the client via `supabase.from(...).upsert(...)` in
`CompatibilitySurveyPage.tsx`/`TenantQuestionnairePage.tsx`; `server/index.ts` only ever
*reads* these tables (for matching). The dedicated-column writes were added at the actual
client upsert call sites instead.

### Motion Designer (single instance)
No new Hooked moments — additional questionnaire questions and a server-side matching
rule are not new interaction/reward moments, consistent with MOTION.md's guardrail for
informational/form steps.

### UX Auditor (single instance)
- UX-10 (Components Behave Consistently): both new questions render through each
  questionnaire's existing generic choice-button component, no special-casing.
- UX-15 (Simplicity Wins): conditional display was implemented as a minimal generic
  `showIf` field rather than a one-off special case for this specific question, so future
  conditional questions can reuse it.
**UX APPROVED — proceed to QA.**

### QA — two-instance loop
Both instances independently verified all 13 ACs against live code (not assumption).
12/13 CONFIRMED PASS by both. AC-12 (migration applied to live DB) — both instances
correctly flagged they lacked live DB credentials in their sandboxed context to verify
independently; reconciled as CONFIRMED PASS based on this run's own direct `psql`
verification (SELECT against `information_schema.columns` showed all 3 new columns live
before any code was written, confirming the additive migration applied cleanly).
Instance B's adversarial pass additionally flagged a type-soundness gap in
`landlordAnswersToPrefs`'s parameter type (declared `boolean | null`, real runtime value
from JSONB is the string `'yes'/'no'`) — fixed by widening the type to
`boolean | string | null` to match reality instead of relying on an `as` cast. No HARD
FAILs (no mock data, no unverified schema reference, no TypeScript error, no crash path).

### Stress Tester (single instance)
- Pre-existing rows with no answer to the new questions (created before this migration):
  `accepts_housing_vouchers`/`participates_in_voucher_program` read as `null`/`undefined`
  → treated as "unanswered"/"non-voucher" respectively, matching spec (landlords who
  haven't answered are not excluded; tenants default to non-voucher behavior) — PASS.
- No new env vars, no new third-party API calls, no free-text input (all new answers are
  fixed-choice buttons) — no new injection/missing-config surface — PASS.
- Network failure on upsert: unchanged pre-existing `if (error) { setCompleteError(...) }`
  pattern on both questionnaire pages — PASS.

### Build gate
`npx tsc --noEmit`: zero errors, both before and after the QA fix round.

### Dependencies
No new dependency. `package-lock.json` regenerated via the standard workaround to run the
build gate, then reverted (`git checkout -- package-lock.json`) since nothing changed.

### Out of scope (per approved Implementation Prompt — not built this run)
Renter score (`tenantRentScore.ts`) is untouched by design. Plaid-skip-at-100%-coverage,
the shared income-satisfied rule (`GET /api/plaid/verification`), and the "Housing Voucher"
badge on match cards/tenant profile are explicitly separate follow-up tasks per the ticket
— not built, not stubbed.

## 2026-10-19 — Pulse automation run (single-task mode)

Task: Location-based matching — geocode properties & tenant addresses, add lat/lng columns.

### Investigation note (deviation from the ticket's literal description)
The ticket's Implementation Prompt said to wire geocoding into "POST `/api/properties`,
POST `/api/admin/properties`, and PATCH `/api/properties/:id`." None of these endpoints
exist in the live repo: property create/update is done entirely client-side via direct
`supabase.from('properties').insert/update(...)` calls in `AddPropertyPreviewPage.tsx`,
`ListFromReportPage.tsx`, and `LandlordPropertyDetailsPage.tsx` (the only server-side
`/api/admin/properties*` route is `PATCH /api/admin/properties/:id/status`, which never
touches address fields). This also means an `AdminPropertyCreatePage.tsx` referenced in
this project's prior run notes does not exist in current `git log` — either that work
never landed or was lost in a later Replit squash-publish; treated current live repo
state as ground truth rather than stale notes.

Given that architecture, geocoding was wired the same way this repo already proxies
Google Maps calls for Street View/Places (`/api/street-view-image`, `/api/address-suggest`):
a new thin, authenticated `POST /api/geocode` endpoint keeps `GOOGLE_MAPS_API_KEY`
server-side, and each client insert/update call site fire-and-forgets a call to it, then
patches `lat`/`lng` back onto the just-written row via a normal RLS-scoped client update
(own `landlord_id`/`tenant_id` — no new RLS policy needed). Never blocks the user-facing
save.

### Changes
1. `supabase/migrations/20261019000002_tenant_application_profiles_location.sql` — adds
   `lat`/`lng` (double precision) + `idx_tenant_application_profiles_location` btree index
   to `tenant_application_profiles`. Applied live via `psql` and verified via `\d`.
2. `server/geocode.ts` — new `geocodeAddress(address, apiKey)` / `buildAddressString(parts)`
   helpers. Never throws; every failure mode (missing key, non-OK Google status, network
   failure, empty address) resolves to `{ ok: false, status, error_message }` so callers
   can log and continue.
3. `server/index.ts` — new `POST /api/geocode` (requires a signed-in user via the existing
   `authUser` helper; never used by anonymous requests). Calls the new helper and
   `console.error`s a clear `status`/`error_message`/user id line on failure — never logs
   or returns the API key itself.
4. `client/src/lib/geocodeClient.ts` — new shared client helper (`geocodeAddress`,
   `addressKey`) used by all four write sites below; calls `/api/geocode` with the
   session's access token, returns `null` (and logs) on any failure.
5. `client/src/pages/AddPropertyPreviewPage.tsx` / `ListFromReportPage.tsx` — after a
   successful property insert, fire-and-forget geocode the new address and patch
   `lat`/`lng` onto the row.
6. `client/src/pages/LandlordPropertyDetailsPage.tsx` — after a successful property
   update, re-geocodes only if `address_line1`/`city`/`state`/`postal_code` actually
   changed from the previously loaded record (avoids a redundant API call on every save).
   Added optional `lat`/`lng` to the file's `PropertyRecord` type.
7. `client/src/pages/RentalApplicationPage.tsx` — `saveProgress()` now re-geocodes the
   tenant's private application address only when it differs from the last-geocoded
   address (tracked via a ref seeded from the loaded record on mount), since this
   function autosaves on every wizard step.
8. `scripts/backfill-geocode.ts` + `"backfill:geocode"` package.json script — one-time
   backfill for existing `properties`/`tenant_application_profiles` rows with an address
   but `lat IS NULL`. Service-role client, 100ms delay between calls, prints a `SUMMARY`
   plus a per-row failure list (id/status/error_message).

### Step 0 / key verification — could not be run live this session
This Mac automation sandbox has no access to the real `GOOGLE_MAPS_API_KEY` value — it
exists only as a Replit secret in the deployed environment, not in this repo checkout (no
`.env`, not in Pulse credential metadata, which never exposes secret values). A prior
`[HUMAN]` task (`797b8b58`, already `done`) recorded that someone with Google Cloud
Console access confirmed the Geocoding API is enabled for this key — proceeded to build
on that basis rather than fabricating a live test result in this session.
Ran `scripts/backfill-geocode.ts` for real against the live DB in this sandbox (no key
present): all 97 `properties` + 3 `tenant_application_profiles` rows needing backfill
correctly short-circuited to `status=missing_key` and the script printed a full SUMMARY —
this confirms the DB query/update/summary plumbing works end to end; only the actual
Google call is blocked by this environment's missing secret. **A [HUMAN] task has been
filed to re-run `npm run backfill:geocode` from the Replit environment** (where the key
is actually present) once this is pulled/republished, and to confirm Step 0's live
Geocoding API test succeeds there.

### Motion Designer / UX Auditor (single instance each)
No new Hooked moments or user-facing UI — this task is a backend data-layer addition
(migration, server proxy endpoint, fire-and-forget client calls). No new screens, no new
visible states beyond existing save/error flows, which are unchanged.

### QA — two-instance loop
Both instances independently checked: no hardcoded/mock data (real Google Geocoding API
calls, real DB columns); every table/column reference (`tenant_application_profiles.lat/lng`,
`properties.lat/lng`) verified against live schema via `psql`, not assumed; zero TypeScript
errors (confirmed via `git stash -u` A/B — the only `tsc` errors present are a pre-existing,
unrelated `PaymentHistoryPage.tsx` baseline issue, present identically with and without
this change). Instance B (adversarial) flagged that re-geocoding only "on address change"
could mask a case where a user's first save already has an address but the comparison
baseline (`property`/the loaded tenant profile) was itself stale — investigated directly:
not reproducible, since `property`/the loaded profile is always re-fetched fresh before
the form renders, and the ref is seeded from that same fresh load. **CONFIRMED PASS.**

### Stress Tester (single instance)
- Empty/missing address fields: `geocodeAddress` (server) returns `invalid_request` for
  an empty joined address string before ever calling Google — PASS.
- Network failure / Google API timeout: `AbortSignal.timeout(8000)` + try/catch resolves
  to `{ ok: false, status: 'request_failed' }` rather than throwing — PASS.
- Missing env var (`GOOGLE_MAPS_API_KEY` unset): short-circuits to `missing_key` before
  any network call — PASS (verified live via the backfill run above).
- Rapid saves (tenant wizard autosave): `addressKey` ref comparison prevents redundant
  Google calls when the address hasn't changed between autosaves — PASS.
- Invalid/malformed address: Google's own `ZERO_RESULTS` status surfaces as
  `{ ok: false, status: 'no_results' }`, logged, save still succeeds — PASS.

### Build gate
`npx tsc --noEmit` (server, root `tsconfig.json`): zero errors.
`cd client && npx tsc --noEmit`: only the pre-existing `PaymentHistoryPage.tsx` baseline
error (confirmed present identically via `git stash -u` before this change) — zero errors
introduced by this task.

### Dependencies
No new dependency. `package-lock.json` regenerated via the standard workaround to run
`npm install`/the build gate, then reverted (`git checkout -- package-lock.json`).

### Out of scope (per approved Implementation Prompt — not built this run)
Distance/radius matching logic in `server/match.ts` was explicitly out of scope for this
ticket and was not touched.
