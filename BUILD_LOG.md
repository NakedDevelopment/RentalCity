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
