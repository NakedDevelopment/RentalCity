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
