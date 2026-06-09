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
