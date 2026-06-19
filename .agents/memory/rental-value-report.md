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

## Logo (important)
Rental City has **no logo image file**. The brand logo is an inline SVG `Logo()` component in `client/src/components/Layout.tsx` and `TenantLayout.tsx`: a house icon (`stroke=currentColor`, `text-primary` blue) + "Rental City" in `gray-900` (#111827) Inter `font-semibold`. To put the logo anywhere (e.g. the report page), copy that exact SVG markup — do NOT generate new wordmark graphics. On dark backgrounds use the same mark with white text (footer).

## HubSpot lead mirror
Each captured lead is also mirrored into HubSpot from `syncLeadToHubSpot()` (server/index.ts), called inside `captureLead()`. Uses the **public Forms Submission API** `https://api.hsforms.com/submissions/v3/integration/submit/{portalId}/{formGuid}` — **no OAuth/connector needed**; the portal ID + form GUID are the same public IDs used to embed the form (overridable via `HUBSPOT_PORTAL_ID` / `HUBSPOT_FORM_GUID` env).
**Why no connector:** the Replit HubSpot *connector* proxy returned "No hubspot connection found" and OAuth is unnecessary for form submissions. Don't reach for the connector for form submits.
The submission API is **lenient** — it returned 200 even for field names not on the form (unknown fields ignored, not rejected), so we map email/address/property fields + a `message` summary best-effort. Call is awaited but bounded by a 3s AbortController so a slow HubSpot can't stall `/api/estimate`.

## Address autocomplete (RentCast)
Address field on the report uses a debounced dropdown backed by `GET /api/address-search?q=` (server/index.ts) → RentCast `/v1/properties?address=`.
**RentCast quirks for autocomplete:** it is NOT fuzzy as-you-type. Partial/unparseable input returns **HTTP 400** ("could not be parsed or geolocated"); a parseable address with no record returns **404**. Both must be treated as "no suggestions yet" (return []), or every keystroke logs an error / 502. Only a complete-enough address (with city) returns a record. `?city=X&state=Y&limit=N` lists real addresses. Each property record also carries propertyType/bedrooms/bathrooms/squareFootage (available to auto-fill the form later if wanted).
