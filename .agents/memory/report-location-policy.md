---
name: Report location reuse
description: Scope and provider choice for coordinates on report-created listings.
---

Reuse subject-property coordinates from existing RentCast report calls before making a separate geocoding request. Do not use a comparable property's location or reuse the report's location after an address edit.

**Why:** The user requested reuse of the report provider after Google Geocoding was found disabled. An extra provider call is unnecessary when the report already supplies the subject location.

**How to apply:** Preserve this preference in report-to-listing changes, including emailed and cross-origin links. This does not authorize replacing geocoding for arbitrary tenant addresses or bulk-updating existing production listings.
