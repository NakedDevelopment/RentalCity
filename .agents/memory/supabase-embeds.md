---
name: Supabase/PostgREST relationship embeds in this app
description: Non-obvious gotcha when embedding landlord profiles off applications
---

# Embedding landlord profile must go through `property`, not `applications`

`applications` has only `tenant_id -> profiles` (no landlord FK). So a PostgREST
embed like `landlord:profiles(...)` placed directly on an `applications` query
resolves through `tenant_id` and returns the **tenant's** profile mislabeled as
landlord. To get the real landlord, embed through the property relationship:
`property:property_id(..., landlord:landlord_id(id, display_name, phone))`.

**Why:** caused a real bug where a tenant→landlord review was being written with
the tenant's own id as `landlord_id`. RLS policy "Users can read related profiles"
(20250307000004) already lets a tenant read the landlord of a property they
applied to, so the property-nested embed works under RLS.

**How to apply:** any time you need landlord identity/contact from an application
row, source it from `property.landlord_id` / nested `property.landlord`, never a
direct `landlord:profiles(...)` on `applications`.
