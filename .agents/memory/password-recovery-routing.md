---
name: Password recovery routing safety net
description: Why Supabase reset links can land on role-dashboards and how the app guards against it
---

**Rule:** Any Supabase auth redirect (recovery, magic link, invite) can land at the Site URL root instead of the intended `redirectTo` when that URL isn't on the Supabase Auth redirect allow-list. A global handler mounted in App (including during the auth `loading` gate) must intercept `type=recovery` URLs / `PASSWORD_RECOVERY` events and forward to `/reset-password` before role-based redirects (landlord → /matches etc.) hijack the navigation.

**Why:** Client-reported critical bug (July 2026): reset-email links dropped landlords on their dashboard, making password reset impossible. Code was correct; the link simply never reached `/reset-password`.

**How to apply:** Keep `RecoveryLinkHandler` mounted in both App branches (loading + loaded). Only an SDK-validated recovery session may unlock the reset form; a normal login or guessable URL/router state must NOT authorize it. When adding new auth email flows, add their production URLs to Supabase Auth → URL Configuration → Redirect URLs.

Customer recovery requests must explicitly target the verified public reset page. Check Supabase's live Site URL and redirect allow-list separately from the app's own public URL configuration.

**Why:** Publishing app email-link fixes did not correct Supabase Auth's separate configuration: it still used an old Replit preview as its Site URL and sole allowed redirect, sending a member's recovery flow to a stopped preview.

**How to apply:** Keep the Site URL on the verified production origin and explicitly allow its reset page; preserve development allowances separately rather than using a preview as the production default. Fixing Supabase's configuration takes effect independently of publishing client changes. Do not assume an existing recovery email will use newly corrected destinations; request a fresh one.

Capture validated recovery at SDK initialization, before React mounts. Keep that authorization in memory only, tied to the current user, and end it on normal sign-in, sign-out, or a completed user update.

**Why:** Browser verification found a freshly generated recovery link reached production but falsely expired: the SDK consumed its URL fragment and emitted recovery during the auth-loading gate, before the reset page subscribed.

**How to apply:** A later reset form or global recovery handler must be able to recognize the already-validated event. Do not solve the race by authorizing any existing logged-in session or persisting a guessable “recovery=true” flag.

Auth QA must verify a generated recovery link's destination privately before opening it, and must not prefetch a single-use verification link.

**Why:** A hand-built admin REST request used the wrong redirect payload shape and silently targeted production instead of preview, making browser-test findings ambiguous.

**How to apply:** Prefer the existing Supabase Admin SDK for disposable-account recovery links, verify the target environment without logging tokens, and generate without sending email. Never redeem a customer's recovery link as a test.
