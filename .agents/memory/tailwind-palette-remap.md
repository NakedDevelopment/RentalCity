---
name: Tailwind palette remap (client)
description: client/tailwind.config.js remaps semantic color names to status tokens — why "emerald-500" renders the green status color, not real emerald.
---

`client/tailwind.config.js` remaps several default Tailwind palettes to brand/status CSS vars:
- `emerald`, `green` → `--color-status-accepted-*` (green)
- `amber` → `--color-status-locked-*` (amber/brown)
- `gray` → neutral tokens; `sky`/`indigo` partly → primary blue.

**Why:** This is why utility classes like `bg-emerald-500` or `text-emerald-700` render the *status* green, not literal emerald — and why match score bars appeared green.

**How to apply:** To force true brand blue on a surface, use arbitrary hex values (`bg-[#3A7AFE]`, `text-[#3A7AFE]`, `bg-[#EEF4FE]`) rather than relying on `blue-*`/`emerald-*` names. Brand primary is `#3A7AFE` (token `--color-primary`), light `#00BBFF`. Soft active/selected bg used across redesign: `#EEF4FE`. App dashboard bg: `#F8FAFD`.
