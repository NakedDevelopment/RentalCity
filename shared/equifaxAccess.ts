/** V2 approvals predate the expanded application. Keep their access during re-signing. */
export const EQUIFAX_APPLICATION_VERSION = 3

export type EquifaxAccessProfile = {
  equifax_approved_at?: string | null
  equifax_approved_version?: number | null
  equifax_agreement_version?: number | null
  docusign_envelope_status?: string | null
}

export function hasSignedCurrentEquifaxApplication(p: EquifaxAccessProfile | null): boolean {
  return p?.equifax_agreement_version === EQUIFAX_APPLICATION_VERSION &&
    p.docusign_envelope_status === 'completed'
}

export function hasEquifaxCreditAccess(p: EquifaxAccessProfile | null): boolean {
  if (!p?.equifax_approved_at) return false
  // Existing approved users retain access even while the new envelope is sent.
  if (p.equifax_approved_version === 2) return true
  return p.equifax_approved_version === EQUIFAX_APPLICATION_VERSION && hasSignedCurrentEquifaxApplication(p)
}
