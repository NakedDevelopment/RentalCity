---
name: Report location reuse
description: Scope and provider choice for coordinates on report-created listings.
---

Reuse subject-property coordinates from existing RentCast report calls before making a separate geocoding request. Do not use a comparable property's location or reuse the report's location after an address edit.

**Why:** The user requested reuse of the report provider after Google Geocoding was found disabled. An extra provider call is unnecessary when the report already supplies the subject location.

**How to apply:** Preserve this preference in report-to-listing changes, including emailed and cross-origin links. This does not authorize replacing geocoding for arbitrary tenant addresses or bulk-updating existing production listings.

The user clarified that they understood the earlier resolution to mean location lookup would use RentCast rather than Google to avoid the disabled Google service.

**Why:** Recommending Google activation without explaining the narrower implemented scope contradicted that understanding. Preserving report coordinates alone does not satisfy a broader non-Google location-lookup requirement.

**How to apply:** Explain any remaining Google lookup dependencies explicitly; do not present Google activation as the agreed solution. Distinguish completing non-Google lookup from unrelated Google photos or address suggestions, and obtain authorization before bulk data changes or additional paid provider usage.
