---
name: Rental Value Report (lead magnet) architecture
description: Durable decisions for the standalone Rental Value Report / professional rental analysis feature
---

# Rental Value Report — professional analysis

The lead magnet lives at `client/public/rental-value-report/index.html` (ES5-only inline
JS) and `POST /api/estimate` in `server/index.ts`. It enriches a RentCast rent estimate
into a full branded report. There is also a standalone zip share of the same idea; both
hit `/api/estimate`.

## Lead capture
Submissions are captured by `captureLead()` into `public.leads` (source-segmented via the
`source` column, server-only — RLS enabled with NO policies, service role only). Also
mirrored to HubSpot (public Forms API, portal 245183301) and an optional LEAD_WEBHOOK_URL;
all best-effort, never block the response.

## Report persistence — store in Postgres, never on disk
Generated report HTML is stored in the Supabase table `rental_reports` and served by
`GET /api/reports/:id`. reportUrl is `/api/reports/<uuid>`.
**Why:** deploys are Replit Autoscale — the filesystem is ephemeral and multi-instance,
so writing report files to disk (as a standalone app would) would 404 on other instances
/ after restarts.
**How to apply:** any "generate a shareable artifact" feature should persist to Supabase
and serve via an `/api/...` route, not the filesystem.

## Why the report route lives under /api/
`/api/reports/:id` (not `/reports/:id`) so it is: proxied to Express in dev (Vite proxies
only `/api`), excluded from the prod SPA fallback (`/^\/(?!api\/).*/`), and skipped by the
subdomain-rewrite middleware (which ignores `/api/`). A non-/api path would need changes
to all three.

## Emailed CTA links MUST be absolute
The email "View your full report" CTA falls back to `href="#"` unless given an absolute
URL. The server derives the origin via `getReportBaseUrl(req)` (PUBLIC_BASE_URL →
x-forwarded-host/proto → REPLIT_DEV_DOMAIN) and passes the absolute URL to `buildReport`,
while still returning the relative `reportUrl` to the same-origin frontend.

## Template module
`server/report-template.ts` exports `buildReport(input, data, opts) -> {reportHtml,
emailHtml, summary}`. All user/RentCast strings go through `htmlEscape`. Design source of
truth was `attached_assets/_rc_extract/.../templates/rental-analysis-reference.html`
(#00BBFF→#3A7AFE gradient, Inter, navy #0F1E3D). Sections self-omit when their data is
null (property / market / value / comps), so RentCast enrichment failures degrade cleanly.
