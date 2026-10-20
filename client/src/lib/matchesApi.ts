/**
 * API client for server-side match score computation.
 */

export type MatchDimensions = {
  affordability: number
  stability: number
  risk: number
  lifestyle: number
  policy: number
}

export type MatchResult = {
  eligible: boolean
  reasons: string[]
  overall: number
  dimensions: MatchDimensions
  tenantScore?: number | null
  /** Distance in miles between tenant and property, when both have a known location. */
  distanceMiles?: number | null
}

export async function fetchMatchesForTenant(
  accessToken: string,
  tenantId: string,
  propertyIds: string[],
  options?: { limit?: number; radiusMiles?: number; tenantLat?: number; tenantLng?: number },
): Promise<Record<string, MatchResult>> {
  const res = await fetch('/api/matches/for-tenant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      tenantId,
      propertyIds,
      ...(options?.limit != null && options.limit > 0 ? { limit: options.limit } : {}),
      ...(options?.radiusMiles != null ? { radiusMiles: options.radiusMiles } : {}),
      ...(options?.tenantLat != null && options?.tenantLng != null
        ? { tenantLat: options.tenantLat, tenantLng: options.tenantLng }
        : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load match scores')
  }
  const data = await res.json() as { matches: Record<string, MatchResult> }
  return data.matches ?? {}
}

export async function fetchMatchesForLandlord(
  accessToken: string,
  landlordId: string,
  tenantIds: string[]
): Promise<Record<string, MatchResult>> {
  const res = await fetch('/api/matches/for-landlord', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ landlordId, tenantIds }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load match scores')
  }
  const data = await res.json() as { matches: Record<string, MatchResult & { tenantScore?: number | null }> }
  return data.matches ?? {}
}

export type LandlordCatalogRow = {
  propertyId: string
  tenantId: string
  match: MatchResult & { tenantScore?: number | null }
  name: string
  avatarUrl: string | null
  participatesInVoucherProgram: boolean
  voucherCoveragePercentage: number | null
  distanceMiles: number | null
}

export async function fetchLandlordMatchCatalog(
  accessToken: string,
  landlordId: string,
  propertyIds: string[],
  options?: { limitPerProperty?: number; radiusMiles?: number },
): Promise<{ rows: LandlordCatalogRow[] }> {
  const res = await fetch('/api/matches/landlord-catalog', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      landlordId,
      propertyIds,
      ...(options?.limitPerProperty != null && options.limitPerProperty > 0
        ? { limitPerProperty: options.limitPerProperty }
        : {}),
      ...(options?.radiusMiles != null ? { radiusMiles: options.radiusMiles } : {}),
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load match catalog')
  }
  return (await res.json()) as { rows: LandlordCatalogRow[] }
}

/** Landlord-only: universal application row when Supabase RPC/RLS misses match-catalog prospects. */
export async function fetchLandlordTenantUniversalApplication(
  accessToken: string,
  tenantId: string,
): Promise<{ universalApplication: unknown }> {
  const res = await fetch(`/api/landlord/tenant-universal-application/${encodeURIComponent(tenantId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (res.status === 403) {
    return { universalApplication: null }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to load universal application')
  }
  return (await res.json()) as { universalApplication: unknown }
}
