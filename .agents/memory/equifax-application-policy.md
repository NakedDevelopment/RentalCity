---
name: Equifax application policy
description: User-selected signer scope, verification ownership, continuity of approved access, and PDF placement lessons.
---

## One signing session for all signers
The subscriber agreement and U.S. Application for Service belong in the same DocuSign session, reached through one Sign Agreement action. This applies to new applicants and existing signers. Remaining mandatory fields and the conditional shared-office attestation are completed within that session.

**Why:** The user explicitly selected both existing signers and new applicants, and one combined signing session rather than another application form in Rental City.

**How to apply:** Preserve this scope when changing application documents or onboarding. Do not exempt existing signers merely because an earlier agreement was completed.

## Previously approved access stays active
Existing approved landlords keep credit access while re-signing the expanded package. Signing alone must not grant new applicants access.

**Why:** The user chose expanded signing without interrupting access already granted.

**How to apply:** Keep the distinction between historical approval and completion of current paperwork consistent in server checks, browser-read policies, and UI messages.

## Equifax owns business verification
After signing, Equifax sends the landlord a business-verification email link. Rental City staff manually confirm verification before enabling new access.

**Why:** The user described Equifax's verification email as the second step and confirmed the existing manual admin approval mechanism.

**How to apply:** Describe signing as applying, not obtaining access. Never claim an email was sent without evidence, imply Rental City sends Equifax's verification link, or promise a fixed approval time.

## PDF field placement
Derive positional signing tabs from native PDF widget rectangles, accounting for each page's own dimensions. Do not estimate them from downscaled screenshots.

**Why:** Visually estimated positions crossed printed labels and missed fields; the application has different heights on its two pages.

**How to apply:** Inspect the source PDF's form geometry whenever the template changes, then confirm conditional fields and signature layout in DocuSign before treating the signing flow as verified.
