---
name: Production deployment config
description: How the app is built and run in production, and what broke/fixed during deployment emergencies.
---

## Run / build commands
- **Build:** `npm run build` — runs `cd client && vite build` then `esbuild server/index.ts → dist/index.js`
- **Run:** `npm run start` → `node dist/index.js`
- Both configured via `deployConfig({ build: ["npm","run","build"], run: ["npm","run","start"] })`

## Static file serving
- Server serves `client/dist` in production via `express.static` + SPA catch-all
- Condition is `NODE_ENV !== 'development'` (NOT `=== 'production'`) — Replit doesn't always set NODE_ENV=production explicitly
- `dist/` and `client/dist/` are gitignored but ARE included in Replit deployment snapshots

## Domain config (verified)
- Primary: `app.gorentalcity.com`
- Report widget: `value.gorentalcity.com`
- Admin: `admin.gorentalcity.com`
- **`www.gorentalcity.com` is NOT a configured domain** — never use it in hardcoded URLs

## Pitfalls learned
- Using `npm run dev` as the run command is blocked by Replit security scan
- Clearing `dist/` + `client/dist/` from workspace before publishing helped unblock a stuck security scanner
- Replit security scanner can fail with "connection lost" transiently — retry usually works after clearing built artifacts
- `buildListUrl` must use `app.gorentalcity.com` not `www.gorentalcity.com`
