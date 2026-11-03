# Lessons

## 2026-11-03 — Tenant lease signing

- Read the live schema with `psql` before naming columns. `psql` was not installed on this machine; install `postgresql-client` first. `public.leases` did not exist. `properties.lease_term` is only a duration string. Profile DocuSign columns belong to the landlord agreements.
- Do not hardcode DocuSign account `3030222`. `createEmbeddedEnvelope` already uses `DOCUSIGN_ACCOUNT_ID`.
- Do not call `createEmbeddedEnvelope` from tests. The Developer Starter plan is 40 envelopes a month. Test `buildEmbeddedEnvelopeDefinition` and the pure lease helpers instead.
- Uploaded leases have no anchor text. Place a required SignHere and DateSigned on the last page, and set `transformPdfFields` false only for that PDF. Leaving the flag unset keeps the Equifax and Plaid envelopes on their current path. `voidEnvelope` must keep its Equifax reason unless the caller passes another one, and it must never void a completed envelope.
- Store PDFs in a private `leases` bucket and return a view without storage paths. RLS with no policies, plus revoking `anon` and `authenticated`, keeps the Data API from reading another tenant's lease. Downloads go through the bearer API.
- An entrance fade that starts at `opacity: 0` can leave the empty lease card below readable contrast. Match the sibling card with no fade.
- Show the tenant's signed download even when a newer lease is waiting for a signature. An if/else hides the signed copy.
- `npm ci` failed while `package-lock.json` still pointed some packages at `package-firewall.replit.local`. A local rewrite of those URLs to `registry.npmjs.org` installed dependencies; the lockfile was restored and is not part of this change.
