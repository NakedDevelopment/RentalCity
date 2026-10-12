---
name: Equifax application policy
description: User-selected signer scope, verification ownership, continuity of approved access, and PDF placement lessons.
---

## One signing session for all signers
The subscriber agreement and U.S. Application for Service belong in the same DocuSign session, reached through one Sign Agreement action. This applies to new applicants and existing signers. Remaining mandatory fields and the conditional shared-office attestation are completed within that session.

**Why:** The user explicitly selected both existing signers and new applicants, and one combined signing session rather than another application form in Rental City.

The user explicitly confirmed that the shared-space attestation is dynamic: answering Yes to sharing office space with another company/entity requires page-2 completion and signing; answering No legitimately skips that signature.

**How to apply:** Preserve this scope when changing application documents or onboarding. Do not exempt existing signers merely because an earlier agreement was completed.

## Previously approved access stays active
Existing approved landlords keep credit access while re-signing the expanded package. Signing alone must not grant new applicants access.

**Why:** The user chose expanded signing without interrupting access already granted.

**How to apply:** Keep the distinction between historical approval and completion of current paperwork consistent in server checks, browser-read policies, and UI messages.

## Equifax owns business verification
After signing, Equifax sends the landlord a business-verification email link. Rental City staff manually confirm verification before enabling new access.

**Why:** The user described Equifax's verification email as the second step and confirmed the existing manual admin approval mechanism.

**How to apply:** Describe signing as applying, not obtaining access. Never claim an email was sent without evidence, imply Rental City sends Equifax's verification link, or promise a fixed approval time.

## Title choices must match the person and section
The applicant must choose the title that best fits their actual position. Review each field's context rather than applying a dropdown indiscriminately wherever “Title” appears; a principal, contact, and signer may be different people.

**Why:** The user explicitly emphasized that the choices describe the person's position and requested contextual review, not blind replacement of labels.

**How to apply:** Preserve individual selections. Check the underlying form's role requirements before restricting a contact's title to executive positions or copying a signer's title into another person's field.

## Application-form adjustment scope
The requested industry and permissible-purpose prefills and standardized title dropdowns apply only to the newly added two-page Application for Service, not the original subscriber agreement.

**Why:** On 2026-10-07 the user clarified: “These changes were only intended to be for the second part of the agreement that we recently added.”

**How to apply:** Keep these adjustments within the application document. Do not extend them to the original subscriber agreement without an explicit request; its signer title remains free text.

These field-only adjustments do not require another signing round for anyone who has already completed the combined package.

**Why:** The user confirmed that all landlords need the combined documents but explicitly said these final field changes should not prompt requests to sign again.

**How to apply:** Keep existing completion records and the signing version unchanged for these adjustments. Landlords who have not completed the combined package still need to sign it. This does not waive review of future substantive agreement changes.

Publishing form changes does not refresh an already-created DocuSign envelope.

**Why:** An unfinished test package continued showing earlier fields because reopening signing reused the existing envelope snapshot.

**How to apply:** Distinguish completed-package validity from unfinished-envelope freshness. Preserve completed signatures; explicitly address old unfinished envelopes when validating updated forms. Replacing one can discard partial entries and consume another envelope, so explain that before doing it.

## PDF field placement
Derive positional signing tabs from native PDF widget rectangles, accounting for each page's own dimensions. Do not estimate them from downscaled screenshots.

**Why:** Visually estimated positions crossed printed labels and missed fields; the application has different heights on its two pages.

**How to apply:** Inspect the source PDF's form geometry whenever the template changes. Clear and flatten native form widgets in the prepared copy before overlaying controlled DocuSign tabs; preserve the original uploaded template.

Review the executed PDF, not only the signing UI.

**Why:** Native dropdown “Select” appearances remained underneath submitted answers in the executed PDF even when they were not obvious in the signing view. Conversely, DocuSign's temporary “Signature Applied” tooltip covered the name while signing, but was absent from the correctly rendered executed PDF.

**How to apply:** Confirm conditional enforcement in the browser, then inspect the downloaded executed pages for overlapping defaults, overflowing values, and readable signatures.

Optional PDF-tool installation failures still require a workspace-diff review.

**Why:** A failed Python PDF-tool install initialized unrelated Python scaffolding and added system dependencies before failing. The existing Poppler tools were sufficient for visual inspection.

**How to apply:** Check for partial configuration changes after failed tool installs. Keep one-off PDF QA tooling from changing this app's language setup unnecessarily.

## Preserve the live DocuSign setup during QA
Do not replace the app's live DocuSign connection solely to validate a document change. When production testing is explicitly authorized, use clearly labeled fictional test data and isolate test envelopes from Equifax submission and landlord approval handlers.

**Why:** The user reaffirmed that the app is live on production DocuSign, rejected switching that setup back to a test account, and confirmed that clearly labeled test-only applicants make sense.

**How to apply:** Obtain authorization for each production test; this is not blanket permission to create production envelopes. Keep test completion callbacks separate from normal submission, then clean up the test envelope.
