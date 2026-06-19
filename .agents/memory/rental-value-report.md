---
name: Rental Value Report (RentCast lead magnet)
description: How the rental-value lead magnet is wired across its two deployments and where leads land.
---

# Rental Value Report

A RentCast-powered "what could my property rent for" lead-magnet page. It exists in TWO places that share the SAME contract:
- **In-app**: static page at `client/public/rental-value-report/` (served at `/rental-value-report/`, bypasses the React SPA). Backed by `POST /api/estimate` in `server/index.ts`.
- **Standalone**: a separate deployable bundle (`rental-value-report.zip`) with its own CommonJS Express `/api/estimate` — meant to deploy as its own Autoscale Repl, NOT merged into Rental City.

Shared contract: page POSTs `/api/estimate`; server proxies RentCast `avm/rent/long-term` (key `RENTCAST_API_KEY`, server-side). On any non-2xx the page silently falls back to a built-in **sample estimate** — so the in-app iframe shows sample data only if the route/key is missing.

Leads from successful estimates are stored in Supabase **`public.leads`** (`source` column segments by origin, default `rental_value_report`; server-only RLS = enabled with no policies). NDJSON file is only a fallback when Supabase is unconfigured; `LEAD_WEBHOOK_URL` optionally forwards each lead.

Brand wordmarks for the page live at `client/public/rental-value-report/assets/rental-city-wordmark-{gradient,white}.svg` (gradient = top trustbar on white, white = navy footer). Brand gradient: `#00BBFF → #3A7AFE`.
