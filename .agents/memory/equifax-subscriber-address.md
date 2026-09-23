---
name: Equifax subscriber address
description: Which address belongs on a landlord's Equifax Broker Subscriber Agreement.
---

The Equifax Broker Subscriber Agreement must use business/subscriber contact information expressly confirmed by the landlord: business name, phone number, and address are all required before signing. An onboarding business name or general profile phone can be offered for confirmation, but do not assume that phone is the business phone. Never infer the address from a rental property.

**Why:** The user stated rental property and business addresses differ almost all the time, rejected assuming one from the other, and specifically requested required business name, phone, and address fields.

**How to apply:** In any agreement-generation or re-signing flow, require the landlord to review and submit the three business details; do not use a property's address as a fallback.

Landlords who already signed the flawed Equifax template must sign a corrected version labeled “Updated Equifax agreement required.” Keep the old executed agreement as an audit record and send the newly executed version to Equifax; do not treat existing signatures as sufficient for the updated agreement.

**Why:** The user confirmed that Equifax needs to recognize an updated signed agreement from the existing handful of signers, not just from new landlords.

**How to apply:** Make the re-sign requirement visible to affected existing landlords without overwriting prior signed copies. Decide the screening-access policy during re-sign separately from access to unrelated features.

Store confirmed subscriber contact details outside broadly readable landlord profiles. Only the server should read them for the agreement and return them to the authenticated landlord.

**Why:** Related users can read landlord profile rows; a business mailing address submitted for a legal agreement should not become part of that broader profile view.

**How to apply:** When adding agreement-specific contact fields, use a server-only store rather than putting them on `profiles`. Apply the corrected-agreement approval gate to Equifax credit/background access, not to unrelated Plaid bank verification.