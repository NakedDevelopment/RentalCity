export type PlaidVerification = {
  institutionName: string | null
  accountsCount: number

  incomeVerified: boolean
  balancesVerified: boolean
  debtsVerified: boolean
  dtiRatio: number | null
  identityVerified: boolean

  monthlyIncomeRangeLowCents: number | null
  monthlyIncomeRangeHighCents: number | null
  assetTier: string | null

  lastVerifiedAt: string | null
}

export type PlaidIdentityVerificationStatus =
  | 'pending'
  | 'active'
  | 'success'
  | 'failed'
  | 'expired'
  | 'canceled'

export type PlaidIdentityVerificationResult = {
  sessionId: string
  status: PlaidIdentityVerificationStatus
  shareableUrl: string | null
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || fallback)
}

export async function createPlaidLinkToken(accessToken: string): Promise<string> {
  const res = await fetch('/api/plaid/link-token/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not start bank connection')
  const data = (await res.json()) as { linkToken: string }
  return data.linkToken
}

export async function exchangePlaidPublicToken(
  accessToken: string,
  publicToken: string,
): Promise<PlaidVerification> {
  const res = await fetch('/api/plaid/exchange', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ publicToken }),
  })
  if (!res.ok) await parseError(res, 'Could not verify your bank')
  return (await res.json()) as PlaidVerification
}

export async function getPlaidVerification(accessToken: string): Promise<PlaidVerification | null> {
  const res = await fetch('/api/plaid/verification', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 404) return null
  if (!res.ok) await parseError(res, 'Could not load verification status')
  const data = (await res.json()) as { verification: PlaidVerification | null }
  return data.verification
}

export async function refreshPlaidVerification(accessToken: string): Promise<PlaidVerification> {
  const res = await fetch('/api/plaid/refresh', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not refresh verification')
  return (await res.json()) as PlaidVerification
}

export async function createPlaidIdvLinkToken(accessToken: string): Promise<string> {
  const res = await fetch('/api/plaid/idv-link-token/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not start identity verification')
  const data = (await res.json()) as { linkToken: string }
  return data.linkToken
}

export async function createPlaidIdentityVerification(
  accessToken: string,
): Promise<PlaidIdentityVerificationResult> {
  const res = await fetch('/api/plaid/identity-verification/create', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not start identity verification')
  return (await res.json()) as PlaidIdentityVerificationResult
}

export async function getPlaidIdentityStatus(
  accessToken: string,
): Promise<PlaidIdentityVerificationResult> {
  const res = await fetch('/api/plaid/identity-verification/status', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not get identity verification status')
  return (await res.json()) as PlaidIdentityVerificationResult
}
