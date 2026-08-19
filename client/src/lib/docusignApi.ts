// Client-side API wrappers for the landlord DocuSign agreements (Equifax
// Broker Subscriber Agreement + Plaid End Client Consent) that gate access to
// Plaid data, credit checks, and background checks.

export type DocusignStatus = {
  equifaxSigned: boolean
  equifaxApproved: boolean
  equifaxPendingSince: boolean
  plaidSigned: boolean
  fullyVerified: boolean
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || fallback)
}

export async function getDocusignStatus(accessToken: string): Promise<DocusignStatus> {
  const res = await fetch('/api/docusign/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load agreement status')
  return (await res.json()) as DocusignStatus
}

export async function createEquifaxAgreementSigningSession(
  accessToken: string,
): Promise<{ envelopeId: string; signingUrl: string }> {
  const res = await fetch('/api/docusign/equifax-agreement/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not start the Equifax agreement signing session')
  return (await res.json()) as { envelopeId: string; signingUrl: string }
}

export async function createPlaidConsentSigningSession(
  accessToken: string,
): Promise<{ envelopeId: string; signingUrl: string }> {
  const res = await fetch('/api/docusign/plaid-consent/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not start the Plaid consent signing session')
  return (await res.json()) as { envelopeId: string; signingUrl: string }
}

export async function confirmDocusignCompletion(
  accessToken: string,
  envelopeId: string,
  type: 'equifax' | 'plaid',
): Promise<{ completed: boolean; status?: string }> {
  const res = await fetch('/api/docusign/complete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ envelopeId, type }),
  })
  if (!res.ok) await parseError(res, 'Could not verify signing completion')
  return (await res.json()) as { completed: boolean; status?: string }
}
