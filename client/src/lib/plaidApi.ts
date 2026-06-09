export type PlaidVerification = {
  institutionName: string | null
  accountsCount: number
  incomeVerified: boolean
  monthlyIncomeCents: number | null
  balancesVerified: boolean
  availableBalanceCents: number | null
  currentBalanceCents: number | null
  lastVerifiedAt: string | null
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
