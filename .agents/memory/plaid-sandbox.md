---
name: Plaid sandbox quirks & testing
description: Non-obvious gotchas when building/testing Plaid financial verification in this repo's sandbox env
---

# Plaid sandbox income detection is unreliable

The default sandbox institution `ins_109508` (owner "Alberta Bobbeth Charleson")
returns full balances, identity, and liabilities, but its transactions contain
**no real recurring payroll inflow** — `transactionsRecurringGet` only surfaces a
tiny ~$4/mo interest deposit. So any DTI computed as `debt / income` explodes
(e.g. 75,000%).

**How to apply:** Guard DTI — null it when the ratio is implausibly large
(we use `> 5` i.e. >500%) so the UI never renders an absurd percentage. Don't
trust sandbox recurring-income numbers as representative of production payroll.

# Testing server TS that needs injected secrets

The `code_execution` JS sandbox does **NOT** expose secret values via
`process.env` (it's undefined there). To exercise server code that reads
`process.env.PLAID_CLIENT_ID` / `PLAID_SECRET` etc., write a throwaway `.ts` in
the **project root** (so relative imports like `./server/plaid` resolve) and run
it with `npx tsx ./file.ts`. Replit injects the repl's secrets into the shell
env, so `tsx`/`node` invocations via bash see them. Wrap top-level await in an
`async function main(){…}; main().catch(...)` — tsx's cjs transform rejects
top-level await. Bundling axios-based deps (plaid) to ESM via esbuild fails on
dynamic `require`; prefer `tsx` over bundling.

# Plaid verification is signals-only by design (compliance)

The Plaid feature must NEVER store or expose raw financial figures, per-account /
income / debt breakdowns, the account-holder name, or contact PII. Only
verification SIGNALS are persisted/returned: institution_name, accounts_count,
income_verified, balances_verified, debts_verified, dti_ratio, identity_verified,
last_verified_at. The server may compute richer numbers internally
(`PlaidFinancialSummary` still has incomeStreams/accounts/debts arrays) but they
must never leave the server: `verificationRow` is the API allow-list and
`storeVerification` is the persistence allow-list.

**Why:** explicit user/compliance requirement (data minimization). Landlords have
row-level SELECT on `plaid_financial_verifications`, so any sensitive column on
that table is readable by matched landlords. The defensible fix was to DROP the
sensitive columns entirely (migration `20260609120000_plaid_minimize_signals_only`)
so historical data is purged and neither the server nor landlords can ever access
more than signals — not just null them out.

**How to apply:** if asked to "show landlords more detail" or add a number to the
scorecard, do NOT re-add raw columns. Keep the table signals-only; derive any new
signal as a boolean/ratio server-side and add it as a non-PII column. The UI is a
scorecard (Verified badges + DTI%), not a figures dashboard.
