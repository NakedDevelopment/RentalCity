export type LeaseView = {
  id: string
  landlordId: string
  tenantId: string
  propertyId: string
  applicationId: string | null
  status: string
  statusLabel: string
  sentAt: string | null
  completedAt: string | null
  hasOriginal: boolean
  hasSigned: boolean
  propertyLabel: string | null
}

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}))
  throw new Error((err as { error?: string }).error || fallback)
}

export async function getLandlordLease(
  accessToken: string,
  propertyId: string,
  tenantId: string,
): Promise<LeaseView | null> {
  const params = new URLSearchParams({ propertyId, tenantId })
  const res = await fetch(`/api/leases?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load the lease')
  const body = (await res.json()) as { lease: LeaseView | null }
  return body.lease
}

export async function sendLeasePdf(
  accessToken: string,
  file: File,
  input: { propertyId: string; tenantId: string; applicationId?: string | null },
): Promise<LeaseView> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/pdf',
    'X-Lease-Property-Id': input.propertyId,
    'X-Lease-Tenant-Id': input.tenantId,
  }
  if (input.applicationId) headers['X-Lease-Application-Id'] = input.applicationId
  const res = await fetch('/api/leases', { method: 'POST', headers, body: file })
  if (!res.ok) await parseError(res, 'Could not send the lease')
  const body = (await res.json()) as { lease: LeaseView }
  return body.lease
}

export async function getMyLeases(accessToken: string): Promise<{
  action: LeaseView | null
  completed: LeaseView[]
}> {
  const res = await fetch('/api/leases/mine', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not load your lease')
  return (await res.json()) as { action: LeaseView | null; completed: LeaseView[] }
}

export async function createLeaseSigningSession(
  accessToken: string,
  leaseId: string,
): Promise<{ envelopeId: string; signingUrl: string }> {
  const res = await fetch(`/api/leases/${leaseId}/signing-session`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not open the signing session')
  return (await res.json()) as { envelopeId: string; signingUrl: string }
}

export async function downloadLeaseCopy(
  accessToken: string,
  leaseId: string,
  copy: 'original' | 'signed',
): Promise<void> {
  const res = await fetch(`/api/leases/${leaseId}/document?copy=${copy}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) await parseError(res, 'Could not download the lease')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = copy === 'signed' ? 'signed-lease.pdf' : 'lease.pdf'
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
