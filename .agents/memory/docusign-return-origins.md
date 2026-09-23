---
name: DocuSign return origins
description: Return URL and completion recovery constraints for embedded signing behind a proxy.
---

Build embedded DocuSign return URLs from the initiating browser's public origin. Never use a server-only or background-email URL fallback that can resolve to localhost in a published app; fail explicitly if no public origin can be established.

**Why:** DocuSign can complete the ceremony and redirect the iframe to localhost when the published environment lacks a configured app URL. The signer sees a connection error even though the envelope may already be completed.

**How to apply:** Use the request origin when creating recipient views for both Equifax and Plaid, recheck live envelope status after redirect problems, and never create a replacement envelope until a completed existing envelope has been reconciled.