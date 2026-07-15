---
name: Password recovery routing safety net
description: Why Supabase reset links can land on role-dashboards and how the app guards against it
---

**Rule:** Any Supabase auth redirect (recovery, magic link, invite) can land at the Site URL root instead of the intended `redirectTo` when that URL isn't on the Supabase Auth redirect allow-list. A global handler mounted in App (including during the auth `loading` gate) must intercept `type=recovery` URLs / `PASSWORD_RECOVERY` events and forward to `/reset-password` before role-based redirects (landlord → /matches etc.) hijack the navigation.

**Why:** Client-reported critical bug (July 2026): reset-email links dropped landlords on their dashboard, making password reset impossible. Code was correct; the link simply never reached `/reset-password`.

**How to apply:** Keep `RecoveryLinkHandler` mounted in both App branches (loading + loaded). The reset form only trusts `getSession()` when the visit came from a recovery redirect (URL token or forwarded state) — a plain logged-in session must NOT unlock it. When adding new auth email flows, add their production URLs to Supabase Auth → URL Configuration → Redirect URLs.
