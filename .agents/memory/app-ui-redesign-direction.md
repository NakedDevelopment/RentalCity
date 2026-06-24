---
name: App UI redesign direction
description: The agreed visual direction for the tenant/landlord app redesign and why.
---

# Tenant/Landlord app redesign direction

The in-app tenant and landlord UI (NOT admin, NOT the lead-magnet rental value report) is being redesigned to match the polished look of the lead magnet at `client/public/rental-value-report/index.html`. The lead magnet is the explicit quality bar / visual target.

**Rules to keep consistent:**
- Brand stays **blue**: gradient `linear-gradient(83.7338deg, #00BBFF 11.921%, #3A7AFE 90.638%)`, ink `#0F1E3D`, navy `#0A1733`, on clean white, Inter font.
- **Remove the off-brand greens** (`#0E7B20`, `#4CD964`, `#CDF7D4`). Match-score badges and positive states should use blue-harmonized accents, NOT saturated green.
- Replace the hand-rolled inline-SVG nav icons (the "AI-looking" icons) with **lucide-react** icons.
- The current app shell (`client/src/components/TenantLayout.tsx`) aligns its sidebar with a fragile hack (negative margins `-ml-4 -mr-4` + invisible `w-56` spacer divs in header/footer + asymmetric `pl-2 pr-4`). The redesign uses a clean, properly aligned sidebar grid instead.

**Why:** User reported the app looks wonky vs. the lead magnet — sidebar "fixed at a strange position," green colors clashing with the blue brand, and strange AI icons.

**How to apply:** Redesign mockups live in `artifacts/mockup-sandbox/src/components/mockups/tenant-app/` (`Current.tsx` baseline, `Redesigned.tsx` tenant, `LandlordRedesigned.tsx` landlord). When graduating into the real app, apply this direction to the shared shell (covers both roles) and the dashboard pages.
