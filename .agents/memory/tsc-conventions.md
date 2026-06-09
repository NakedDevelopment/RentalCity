---
name: Client TypeScript conventions
description: How to keep `tsc -p client/tsconfig.json` clean given strict + noUnusedLocals and Supabase typing quirks
---

# Client tsc conventions

The client tsconfig is `strict` with `noUnusedLocals` + `noUnusedParameters`, so unused
imports/locals/params are hard errors. `npx tsc -p client/tsconfig.json --noEmit` is the
gate (the production esbuild/vite build does NOT type-check, so tsc can drift silently).

## Supabase embedded to-one joins are mis-typed as arrays
A select like `landlord:landlord_id(display_name)` or `property:property_id(...)` returns a
single object at runtime, but supabase-js's generated types infer it as an array (`{...}[]`).
This produces TS2352 "neither type sufficiently overlaps" on casts.

**Convention:** cast through `unknown` — `(data ?? []) as unknown as Row[]` — and rely on the
existing `normalize*` helpers (e.g. `normalizeTenantEmbeds`, `normalizeLandlordReviewRows`)
which already absorb the object-vs-array shape at runtime.
**Why:** the runtime shape is correct; only the static type is wrong. Do NOT "fix" by changing
the query or the runtime mapping.

## Set-but-never-read React state
When a `useState` value is populated by its setter but never read in JSX (incomplete/未-rendered
feature), anonymize the binding: `const [, setX] = useState(...)`. Keep the setter and the
fetch/effect intact.
**Why:** preserves the feature code (ready to render later) instead of deleting it. Deleting
fetch/state/helpers in a "tsc cleanup" pass is feature deletion and was flagged as a regression
risk in review. Prefer minimal typing fixes over removing behavior.

## import.meta.env typing
Requires `client/src/vite-env.d.ts` containing `/// <reference types="vite/client" />`.
Without it, `import.meta.env` errors with TS2339 in tsc even though vite builds fine.
