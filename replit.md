# Rental City

Tenant–landlord matching platform for rental properties.

## Tech Stack

- **Frontend**: React 18 + Vite 5 + TypeScript + Tailwind, in `client/`
- **Backend**: Express (Node 20) + TypeScript, in `server/`
- **Database & Auth**: Supabase (Postgres, Auth, Storage, Realtime); migrations in `supabase/`
- **Integrations**: Stripe, MailerSend, Plaid, BackgroundChecks.com, Google Maps

## Replit Environment Setup

- **Workflow** `Start application` runs `npm run dev`, which uses `concurrently` to start:
  - Vite dev server on `0.0.0.0:5000` (the user-facing webview port)
  - Express API on `localhost:3001`
- Vite proxies `/api/*` to the Express server in dev.
- `client/vite.config.ts` is configured for the Replit proxied iframe:
  - `host: '0.0.0.0'`, `port: 5000`, `strictPort: true`
  - `allowedHosts: true` to bypass host header verification
  - HMR uses `wss` with `host: REPLIT_DEV_DOMAIN` and `clientPort: 443` so HMR works through the Replit proxy
- `envDir: '..'` so Vite reads env vars from the project root `.env.local` (matches existing convention).

## Environment Variables

Copy `.env.example` to `.env.local` and fill in the values. The app boots with placeholder values, but Supabase-backed features (auth, data) require real keys. Server-side integration features need their respective keys (Stripe, MailerSend, BackgroundChecks.com, etc.).

## Build & Deploy

- Build: `npm run build`
  - Builds the React client to `client/dist/` (Vite)
  - Bundles the Express server to `dist/index.js` (esbuild, ESM, externals kept)
- Start (production): `node dist/index.js`
  - In production (`NODE_ENV=production`), the Express server also serves the static client files from `client/dist/` and falls back to `index.html` for client-side routes (SPA).
- **Deployment**: Configured as Replit Autoscale.
  - Build: `npm run build`
  - Run: `bash -c "PORT=5000 NODE_ENV=production node dist/index.js"`

## Project Structure

```
.
├── client/             # React + Vite frontend
│   ├── src/
│   └── vite.config.ts
├── server/             # Express API + integrations
│   ├── index.ts
│   └── match.ts
├── supabase/           # Migrations and config
├── scripts/            # DB migration / seed scripts
└── package.json
```

## Notes

- The original `package.json` build script had a bug where esbuild was invoked from the `client/` directory with `server/index.ts`, causing "entry point cannot be marked as external". Fixed to `cd client && vite build && cd .. && esbuild ./server/index.ts ...`.
- The Express server now conditionally serves the built client assets only in production, leaving dev behavior (Vite proxy) unchanged.
