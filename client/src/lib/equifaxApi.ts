// Client-side API wrappers for the Equifax credit check and background check flows.

export type CreditCheckInfo = {
  id: string | null
  status: 'none' | 'pending' | 'complete' | 'failed'
  equifax_report_id: string | null
  requested_at: string | null
  tenantHasConsent: boolean
}

export type BackgroundCheckInfo = {
  status: 'none' | 'pending' | 'complete' | 'failed'
  criminal_pass: boolean | null
  eviction_pass: boolean | null
  checked_at: string | null
  tenantHasConsent: boolean
}

export type ConsentFormData = {
  firstName: string
  lastName: string
  ssn: string
  dateOfBirth: string
  houseNumber: string
  streetName: string
  streetType: string
  city: string
  state: string
  zip: string
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || fallback)
}

// ─── Tenant endpoints ─────────────────────────────────────────────────────────

export async function saveConsentData(
  accessToken: string,
  data: ConsentFormData,
): Promise<void> {
  const res = await fetch('/api/equifax/consent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(data),
  })
  if (!res.ok) await parseError(res, 'Could not save your information')
}

export async function getConsentStatus(
  accessToken: string,
): Promise<{ hasConsent: boolean }> {
  const res = await fetch('/api/equifax/consent', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load consent status')
  return (await res.json()) as { hasConsent: boolean }
}

// ─── Landlord endpoints ───────────────────────────────────────────────────────

export async function getLandlordEquifaxStatus(
  accessToken: string,
): Promise<{ approved: boolean; pending: boolean }> {
  const res = await fetch('/api/equifax/landlord/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load Equifax status')
  return (await res.json()) as { approved: boolean; pending: boolean }
}

export async function requestEquifaxApproval(accessToken: string): Promise<void> {
  const res = await fetch('/api/equifax/landlord/request-approval', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not submit approval request')
}

export async function getCreditCheckInfo(
  accessToken: string,
  tenantId: string,
): Promise<CreditCheckInfo> {
  const res = await fetch(`/api/equifax/credit-check/${tenantId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load credit check status')
  return (await res.json()) as CreditCheckInfo
}

export async function requestCreditCheck(
  accessToken: string,
  tenantId: string,
): Promise<CreditCheckInfo> {
  const res = await fetch(`/api/equifax/credit-check/${tenantId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not request credit check')
  return (await res.json()) as CreditCheckInfo
}

export async function getBackgroundCheckInfo(
  accessToken: string,
  tenantId: string,
): Promise<BackgroundCheckInfo> {
  const res = await fetch(`/api/equifax/background-check/${tenantId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load background check status')
  return (await res.json()) as BackgroundCheckInfo
}

export async function requestBackgroundCheck(
  accessToken: string,
  tenantId: string,
): Promise<BackgroundCheckInfo> {
  const res = await fetch(`/api/equifax/background-check/${tenantId}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not request background check')
  return (await res.json()) as BackgroundCheckInfo
}
