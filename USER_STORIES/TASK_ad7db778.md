# Listing Agent role (ad7db778)

## PM decision (the ticket's own open question)
Ticket asked: "Should 'Listing Agent' be functionally identical to 'Landlord', or does it need a
distinct onboarding flow/restricted feature set?" Decision: **functionally identical to Landlord**
(same onboarding, same features, same RLS) for this pass — the ticket's own Implementation Prompt
already assumes this throughout (same redirect, "treated as landlord-equivalent for routing").
A distinct restricted feature set is a separate future decision, not blocking this ticket.

## Investigation note (deviation from the ticket's literal file-by-file audit)
The ticket's point 5 asks to audit and update ~7 `profileRole !== 'landlord'` call sites
individually (CompatibilitySurveyPage, LandlordMatchPage, TenantLayout, YourMatchesPage,
AccountPage, LandlordRatingsGivenPage). All of these read `profileRole` from the single
`useProfileRole()` hook, which already normalizes `listing_agent` → `'landlord'` at the source
(see Dev section). Editing all 7 downstream call sites individually would be redundant with, and
riskier than, fixing the one normalization point — so those 7 files are intentionally **not**
touched. `AdminUsersPage.tsx`/`AdminUserDetailPage.tsx` DO need direct updates since they render
the raw `profiles.role` string from the admin directory endpoint, bypassing the hook entirely.
Server-side: confirmed no `role === 'landlord'` string check exists in `server/index.ts` —
property-posting is gated by `landlord_memberships`, not the role enum — so no server change needed.

## Acceptance Criteria
- AC-01: Given the signup role-selection screen, when a user views step 1, then "Listing Agent"
  appears as a third option after "Landlord".
- AC-02: Given a user signs up as Listing Agent, then `profiles.role = 'listing_agent'` in the DB
  and they land on `/onboarding/profile` (same as landlord).
- AC-03: Given a listing agent anywhere `useProfileRole()` is consulted, then they're treated
  identically to a landlord (property listing, matching, compatibility survey all accessible).
- AC-04: Given the admin user directory, then "Listing agents" is a filterable role and shows a
  distinct badge color (not conflated with Landlord or Tenant).
- AC-05: Given a listing agent's admin detail page, then "Listed properties" and "Equifax Credit
  Access" panels render (same as for a landlord row).
- AC-06: Given RoleSelectionPage (post-login role picker), then Listing Agent is also selectable
  there, consistent with SignupPage.

## QA note — self-heal write-back correctness
The pre-existing "self-heal" pattern (`useProfileRole.ts`, `VerifyEmailSuccessPage.tsx`) writes
`profiles.role` back to `'landlord'` if `user_metadata.role` and the DB row disagree (a signup
race condition fix). Naively widening this to treat `listing_agent` as landlord-equivalent risked
silently overwriting a listing agent's real DB role to `'landlord'`, destroying the admin-visible
distinction. Fixed by healing to the metadata's *actual* role (`listing_agent` stays
`listing_agent` in the DB) while only the in-memory `resolved`/`isLandlord` app-level value
normalizes to `'landlord'` for routing/gating purposes.

## Dev
- `supabase/migrations/20261019000003_add_listing_agent_role.sql` — `ALTER TYPE user_role ADD
  VALUE IF NOT EXISTS 'listing_agent'` (additive, applied live via psql, verified via
  `enum_range(NULL::user_role)`).
- `SignupPage.tsx` — `Role` type, third button, step-2 banner/description text, redirect logic.
- `RoleSelectionPage.tsx` — `Role` type, third button (grid changed from 2-col to stacked to fit
  three options), `handleSave` already correctly falls through to the landlord path.
- `useProfileRole.ts` — both DB-role→app-role mappings now treat `landlord`/`listing_agent` as
  `'landlord'`; self-heal preserves the real metadata role in the DB (see QA note above).
- `VerifyEmailSuccessPage.tsx` — same corrected self-heal pattern.
- `AdminUsersPage.tsx` — `RoleFilter` type + dropdown option for `listing_agent`.
- `AdminUserDetailPage.tsx` — `RoleBadge` gets a distinct amber variant (matches the signup
  button's icon color) instead of falling into the tenant-colored "else" bucket; both
  `row.role === 'landlord'` panel guards widened to include `listing_agent`.
