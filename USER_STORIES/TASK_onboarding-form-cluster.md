# Landlord onboarding form fixes (102ab12b, 68e69184, c6265c7d, a2cfd2b5, 57f00fb2)

## Investigation (ground truth vs ticket assumptions)
Tickets split into two groups that actually target two different forms:
- 102ab12b / 68e69184 (require phone / full name) correctly named `ProfileCreationPage.tsx`.
- c6265c7d / a2cfd2b5 / 57f00fb2 described "the landlord onboarding/agreement form... part of
  the DocuSign landlord agreement flow" without naming a file — that's `EquifaxSubscriberForm.tsx`
  (rendered inside `LandlordAgreementsModal.tsx`), not `ProfileCreationPage.tsx`.

Direct code read found **a2cfd2b5 (split address) and 57f00fb2 (phone auto-format) are already
fully implemented** in `EquifaxSubscriberForm.tsx` — street/unit/city/state/zip are already
separate fields, and `formatBusinessPhone()` already live-formats to `(XXX) XXX-XXXX` on every
keystroke. Only c6265c7d (disable Continue until valid) was a real gap there — the submit button
was only disabled on `submitting || addressTooLong`, not on missing/invalid required fields
(required-ness was native-HTML-only, not proactive).

## Acceptance Criteria
- AC-01 (102ab12b): Given a landlord on ProfileCreationPage with an empty phone field, when they
  click Continue, then an inline error shows and they do not advance.
- AC-02 (68e69184): Given a landlord with an empty full name, when they click Continue, then an
  inline error shows and they do not advance.
- AC-03: Given valid phone and name, when Continue is clicked, then the save/navigate proceeds
  exactly as before (no regression to the happy path).
- AC-04 (c6265c7d): Given the Equifax subscriber-details form (business name, phone, street,
  city, state, zip), when any required field is empty or invalid (phone not 10 digits, state not
  2 letters, zip not 5/9 digits, address > 85 chars), then "Continue to sign" is disabled; when
  all are valid, it's enabled.
- AC-05 (a2cfd2b5): Already satisfied — verified live, no code change.
- AC-06 (57f00fb2): Already satisfied — verified live, no code change.

## PM review
Confirmed file-target split is correct per direct code read, not ticket assumption. Scope for
c6265c7d narrowed to the Equifax form specifically (its fields — business name/phone/address —
match the ticket's example list verbatim), not also re-litigating ProfileCreationPage's Continue
button, which 102ab12b/68e69184 explicitly spec as inline-error-on-click (not pre-disabled) and
explicitly say not to change further ("Do NOT add... the client-side guard is sufficient").
**PM APPROVED — proceed to development.**

## Dev
- `ProfileCreationPage.tsx`: added `fullNameError`/`phoneError` state, guard in `handleNext`,
  inline error text + red border, cleared on change. Landlord branch only (tenant branch
  untouched, per 68e69184's explicit instruction not to touch SignupPage/tenant flow).
- `EquifaxSubscriberForm.tsx`: added `formValid` (mirrors server's `normalizeEquifaxSubscriberDetails`
  format checks) and wired it into the submit button's `disabled`.

## Already-done verification (a2cfd2b5, 57f00fb2)
Read `EquifaxSubscriberForm.tsx` directly — `street`/`unit`/`city`/`state`/`zip` are four/five
independent controlled inputs (not a single free-text field), and `formatBusinessPhone()` runs
on every `onChange`. No code change needed; marking both `submitted`/`approved` on evidence of
direct code inspection, not ticket-status assumption.
