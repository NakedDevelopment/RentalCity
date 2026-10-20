---
name: Report location reuse
description: Non-Google location policy, report coordinate reuse, and approximate city search boundaries.
---

Reuse subject-property coordinates from existing RentCast report calls before making a separate geocoding request. Do not use a comparable property's location or reuse the report's location after an address edit.

**Why:** The user requested reuse of the report provider after Google Geocoding was found disabled. An extra provider call is unnecessary when the report already supplies the subject location.

**How to apply:** Preserve this preference in report-to-listing changes, including emailed and cross-origin links. Reuse existing subject data before adding a billable property lookup.

The user clarified that they understood the earlier resolution to mean location lookup would use RentCast rather than Google to avoid the disabled Google service.

**Why:** Recommending Google activation without explaining the narrower implemented scope contradicted that understanding. Preserving report coordinates alone does not satisfy a broader non-Google location-lookup requirement.

**How to apply:** Explain any remaining Google lookup dependencies explicitly; do not present Google activation as the agreed solution. Distinguish completing non-Google lookup from unrelated Google photos or address suggestions, and obtain authorization before bulk data changes or additional paid provider usage.

The user approved completing non-Google lookup across property/tenant addresses and city/ZIP radius search, including RentCast requests to populate missing existing listing coordinates. Google Street View and address suggestions remain in scope unchanged.

**Why:** The release must not require activation of Google Geocoding. RentCast searches for properties in a city are not a reliable way to choose the city's center.

**How to apply:** Use approximate postal-area centers only for explicit area searches, never as fabricated exact property coordinates. Keep unresolvable properties unknown and visible per the existing matching policy. Future bulk operations still need their own authorization; the approved listing backfill is not a standing grant to alter production data.
