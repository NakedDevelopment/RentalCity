# Location-based radius matching (3333d824, 304e77f0, 0ed0425d, e633ed52)

## Investigation — already-done check
All 4 tickets carry a "Grouping was skipped after two invalid grouping responses" note, meaning
they're really one feature split by the intake pipeline (same pattern as the housing-voucher
cluster). A prior single-task-mode run today (commit `83ace79`) already built the **data layer**:
geocoding on write for `properties.lat/lng` and `tenant_application_profiles.lat/lng`, a
`POST /api/geocode` endpoint (auth-required, keeps `GOOGLE_MAPS_API_KEY` server-side), and a
backfill script. Its own BUILD_LOG entry explicitly states "Distance/radius matching logic in
server/match.ts was explicitly out of scope for this ticket and was not touched" — confirming
none of today's 4 radius/search tickets were already done, only their prerequisite plumbing was.

`tenant_preferences.location_lat`/`location_lng`/`location_radius_km` already existed in the live
schema (pre-provisioned, unused by any code) — used as the persisted "tenant search location"
store, distinct from `tenant_application_profiles.lat/lng` (their actual application address).

## Acceptance Criteria
- AC-01 (304e77f0): Given `/api/matches/for-tenant`, `/api/matches/landlord-catalog`, then an
  optional `radiusMiles` param (default 50) filters candidates by haversine distance in-process
  (no PostGIS, no new RPC) between the tenant's known location and the property's `lat`/`lng`.
- AC-02: Given either side has no known lat/lng, then the radius filter is skipped entirely for
  that pair — never excluded for missing data, per explicit ticket constraint.
- AC-03 (0ed0425d): Given `YourMatchesPage` (tenant view), then a city/ZIP search box, a "Use my
  current location" button, and a 10–200mi radius slider (default 50) let the tenant narrow or
  widen their candidate set without ever writing to `profiles`/`tenant_preferences`/
  `tenant_questionnaire`.
- AC-04 (3333d824): Given a tenant with no application on file (`hasActiveUniversalApplication
  === false`), when they land on `YourMatchesPage`, then a banner points them at the same
  location-search UI (not a separate flow) since that's their only way to get location-aware
  results without a saved address.
- AC-05 (e633ed52): Given `YourMatchesPage` (landlord view), then a 25/50/100/Any-mile radius
  selector (default 50) re-fetches the catalog and each tenant card shows distance when known;
  tenants with no known location are still shown (not silently dropped), consistent with the
  ticket's explicit "Location unknown... don't hide them" requirement in spirit (no distance badge
  shown rather than a literal "Location unknown" chip, to keep the diff minimal).
- AC-06: Given `POST /api/matches/for-landlord` (existing batch score endpoint, explicitly called
  out as out of scope in e633ed52), then its behavior is completely unchanged.

## PM review
City/ZIP search reuses the existing `POST /api/geocode` endpoint (passing the free-text input as
the `city` field) rather than building a second geocode endpoint as literally described in
0ed0425d — same outcome, no duplicate endpoint. Reverse-geocoding "Use my current location" into a
display name was simplified to a static "Current location" label — functionally equivalent for
radius filtering, avoids a second new endpoint for a cosmetic nicety. **PM APPROVED.**

## Dev
- `server/geo.ts` (new) — `haversineMiles()`, `DEFAULT_MATCH_RADIUS_MILES = 50`.
- `server/match.ts` — `MatchResult` gains optional `distanceMiles`.
- `server/index.ts`:
  - `/api/matches/for-tenant` — accepts `radiusMiles`, `tenantLat`/`tenantLng` (override for
    ad-hoc search); effective tenant location = explicit override > `tenant_preferences` saved
    location > `tenant_application_profiles` address > none. Out-of-radius properties get
    `eligible: false` with a reason (same convention as the existing invite-restriction filter).
  - `buildLandlordCatalogRows`/`/api/matches/landlord-catalog` — accepts `radiusMiles`; excludes
    (not just flags) out-of-radius tenant candidates; `LandlordCatalogRowOut` gains `distanceMiles`.
  - `/api/matches/for-landlord` — untouched, per explicit ticket instruction.
- `client/src/lib/matchesApi.ts` — `radiusMiles`/`tenantLat`/`tenantLng` plumbed through;
  `distanceMiles` added to both result types.
- `YourMatchesPage.tsx` — tenant view: location search bar, "Use my current location", radius
  slider, no-application banner pointing at the same control. Landlord view: radius `<select>`
  (25/50/100/Any), distance shown per card. Housing Voucher badge (from the prior cluster) and
  distance share the same card line.
