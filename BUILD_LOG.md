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
