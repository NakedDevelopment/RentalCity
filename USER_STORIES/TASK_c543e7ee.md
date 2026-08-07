# TASK c543e7ee — Redesign Admin Landlord Detail Page — Rich Profile View

## Schema cross-reference (verified live via psql, 2026-08-07)
- `profiles.avatar_url`, `display_name`, `phone`, `bio`, `business_name`, `city`, `created_at` — all exist.
- `properties.id/title/address_line1/city/state/status/monthly_rent_cents/bedrooms/bathrooms/photo_urls/created_at/landlord_id` — all exist.
- `properties.status` real enum (from `20250225000001_initial_schema.sql` CHECK constraint): `draft | active | leased | inactive`. There is no literal `'rented'` value — the "rented out" count in the task description maps to `status = 'leased'`.
- `last_sign_in_at` is not in `public.profiles` — it lives on `auth.users`, matching the task's own note that the server route must pull it via the existing `admin.auth.admin.listUsers()` call (already used in `/api/admin/directory`).

## Acceptance Criteria

AC-01: Given an admin viewing `/admin/users/:id` for a user with `role = 'landlord'`, when the page loads, then it shows a hero header with avatar (real `avatar_url` image, or an initial-letter placeholder if null), display name (or "—"), a role badge, and a status badge (Active/Suspended).

AC-02: Given a landlord profile, when the Contact & Account Info section renders, then it shows email (mailto link), phone (or "Not provided"), member since (formatted `created_at`), and last seen (formatted `last_sign_in_at`, or "Never" if null).

AC-03: Given a landlord with properties, when the Properties section renders, then it shows a "Listed Properties" heading with a count badge, a responsive card grid (2 cols md+) with photo thumbnail, title/address, city/state, beds · rent, and a status badge per card, and each card links to the existing `/admin/properties/:id` (AdminPropertyDetailPage).

AC-04: Given a landlord with zero properties, then the Properties section shows a muted "No properties listed yet" empty state instead of an empty grid.

AC-05: Given a landlord with properties, then a separate summary stat shows the count of properties where `status = 'leased'` ("X rented out").

AC-06: Given a non-landlord profile (tenant/admin), then the Properties section is not rendered at all (task explicitly scopes it to landlords).

AC-07: Given the existing suspend/reactivate button logic, self-suspend guard, and admin-suspend guard, then all three behave exactly as before the redesign (no regression).

AC-08: Given the `/api/admin/directory` server route, when called, then the response includes `avatar_url` and `last_sign_in_at` per user, sourced from `profiles.avatar_url` and `auth.users.last_sign_in_at` respectively — verified against real schema, no invented columns.

AC-09: Given a network/Supabase failure while fetching the landlord's properties, then the page still renders the profile header/contact info and shows an inline error for the properties section only (does not blank the whole page).

AC-10: Given the routing (`/admin/users/:id`), back-navigation, and all other admin pages, then none of these are changed by this task.

## PM AGENT REVIEW

1. ACs checked against task description — AC-01 through AC-07 map directly to the seven numbered items in the ticket description; AC-08 covers the required server/type extension; AC-09/AC-10 are the standard edge-case/non-regression ACs this process requires beyond the ticket's literal text.
2. Added AC-06 (non-landlord hides Properties section) and AC-09 (partial-failure isolation) — implied by "Properties section (landlord only)" and general error-handling requirements but not spelled out in the ticket.
3. Corrected one implicit assumption in the ticket: "rented-out" maps to `status = 'leased'`, not a literal `'rented'` string — flagged in the schema cross-reference above, no [HUMAN] task needed since this is a wording-vs-enum mismatch, not a missing column.
4. No AC references a table/column outside the verified schema.

**PM APPROVED — proceed to development**
