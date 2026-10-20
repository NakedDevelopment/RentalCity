# Admin Landlords list enhancements (3c824f24, c64fcba6, 0ddbe874)

## Investigation
There is no dedicated "Admin Landlords" page — all three tickets target `AdminUsersPage.tsx`
filtered to `role=landlord` (confirmed: the existing `?role=` query param and dropdown already
support this). "Paid" status reuses the existing `landlord_memberships` table + the already-shipped
`membershipIsActive()` helper (same definition the landlord's own membership check uses) rather
than calling the Stripe API live per row — faster and avoids a second source of truth. "Portal
link" in the ticket text is `landlord_invite_links` (token-based share link, `TenantInviteLandingPage.tsx`
+ `preview_landlord_invite`/`redeem_landlord_invite` RPCs) — there was no view-count column, so one
was added.

## Acceptance Criteria
- AC-01: Given the admin user directory, when role=landlord or listing_agent, then a "Paid" column
  shows a green "Paid" badge (active, unexpired `landlord_memberships` row) or a gray "Unpaid"
  badge — accurate relative to Stripe's synced state, not merely profile existence.
- AC-02: Given the same rows, then a "Properties" column shows the count of properties owned;
  zero is visually distinct (amber) so Richard can spot landlords who never listed anything.
- AC-03: Given the same rows, then a "Link views" column shows how many times an external visitor
  (not the landlord themselves) previewed their invite link; zero is visually distinct.
- AC-04: Given a tenant or admin row, then all three new columns show "—" (not applicable), not a
  false "Unpaid"/zero.
- AC-05: Given the directory endpoint, then no raw Stripe customer ID or card detail is exposed —
  only the derived boolean/counts.

## PM review
Scope narrowed to AdminUsersPage (confirmed only candidate) and the already-synced DB tables
(no live Stripe calls, no new RLS since this is a service-role server read). **PM APPROVED.**

## Dev
- `supabase/migrations/20261019000004_landlord_invite_link_views.sql` — additive `view_count`
  column on `landlord_invite_links`; `preview_landlord_invite` RPC now increments it on every
  preview where the viewer isn't the invite's own landlord (`auth.uid() IS DISTINCT FROM
  v_landlord_id`). Applied live via psql, verified via `\d landlord_invite_links`.
- `server/index.ts` `/api/admin/directory` — added `landlord_memberships`, `properties` (tallied
  in JS, one query not N+1), and `landlord_invite_links` (summed in JS) lookups; merged into each
  row as `has_paid_subscription`/`property_count`/`portal_link_views`.
- `client/src/lib/adminApi.ts` — `AdminDirectoryUser` type gains the three fields.
- `AdminUsersPage.tsx` — three new table columns, each showing "—" for non-landlord-like roles.
