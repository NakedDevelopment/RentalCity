---
name: Customer-facing link origins
description: Public destination rules for landlord emails and tenant invitation links.
---

Customer-facing emailed buttons and copied tenant invitations must use the verified published app origin, not localhost, a preview server, or the sender's request Origin header. Reject invalid configured origins rather than shipping local links. Keep the tenant invitation token and access window unchanged when correcting a URL's origin.

**Why:** A customer reported “localhost refused to connect” after clicking the landlord onboarding email's “View My Properties” button. Production lacked an explicit app URL, exposing a local fallback. A preview-origin share link poses the same customer-facing risk even though the live invitation lookup works.

**How to apply:** Verify the current public URL through deployment metadata before changing the canonical origin. Check both emailed buttons and both kinds of copied tenant invitations. Already-delivered emails cannot be repaired; offer a replacement only with authorization, without resetting deduplication or access records.