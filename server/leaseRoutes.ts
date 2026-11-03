import express, { type Request, type Response } from 'express'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import { publicAppUrl } from '../shared/publicAppUrl'
import {
  createEmbeddedEnvelope,
  createEmbeddedSigningUrl,
  downloadCompletedDocument,
  getEnvelopeStatus,
  voidEnvelope,
} from './docusign'
import { docusignReturnOrigin } from './docusignReturnOrigin'
import { sendReportEmail } from './email'
import {
  LEASE_BUCKET,
  LEASE_PDF_MAX_BYTES,
  LEASE_VOID_REASON,
  LeaseRequestError,
  assertLeasePdf,
  callerMayDownloadLease,
  escapeHtml,
  isDocuSignNotFound,
  landlordMaySendLease,
  leaseEmailSubject,
  leaseIsOpen,
  leasePublicView,
  leaseReturnUrl,
  leaseSignaturePlacement,
  leaseSignatureTabs,
  logLeaseEnvelopeCreated,
  pickCurrentLease,
  propertyLeaseLabel,
  shouldStoreSignedPdf,
  shouldVoidExistingLease,
  type LeaseRow,
} from './leaseSigning'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LEASE_COLUMNS =
  'id, landlord_id, tenant_id, property_id, application_id, original_storage_path, signed_storage_path, envelope_id, envelope_status, sent_at, completed_at, created_at, property:property_id(title, address_line1, city)'

type PropertyEmbed = {
  title?: string | null
  address_line1?: string | null
  city?: string | null
}

type LeaseQueryRow = Omit<LeaseRow, 'property_label'> & {
  property?: PropertyEmbed | PropertyEmbed[] | null
}

let adminClient: SupabaseClient | null = null

function getAdmin(): SupabaseClient | null {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  if (!adminClient) {
    adminClient = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: ws as unknown as typeof WebSocket },
    })
  }
  return adminClient
}

async function bearerUser(req: Request) {
  const header = req.headers.authorization
  const token = header?.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return null
  const admin = getAdmin()
  if (!admin) return null
  const { data: { user }, error } = await admin.auth.getUser(token)
  return error || !user ? null : user
}

function returnOrigin(req: Request): string {
  return docusignReturnOrigin(
    req.get('origin'),
    req.get('sec-fetch-site'),
    publicAppUrl(process.env.APP_URL),
    process.env.NODE_ENV === 'production',
  )
}

function asLeaseRow(row: LeaseQueryRow): LeaseRow {
  const property = Array.isArray(row.property) ? row.property[0] : row.property
  return {
    id: row.id,
    landlord_id: row.landlord_id,
    tenant_id: row.tenant_id,
    property_id: row.property_id,
    application_id: row.application_id,
    original_storage_path: row.original_storage_path,
    signed_storage_path: row.signed_storage_path,
    envelope_id: row.envelope_id,
    envelope_status: row.envelope_status,
    sent_at: row.sent_at,
    completed_at: row.completed_at,
    created_at: row.created_at,
    property_label: property ? propertyLeaseLabel(property) : null,
  }
}

function sendLeaseError(res: Response, err: unknown): void {
  if (err instanceof LeaseRequestError) {
    res.status(err.status).json({ error: err.message })
    return
  }
  console.error('Lease request error:', err instanceof Error ? err.message : String(err))
  res.status(500).json({ error: 'Could not complete that lease request.' })
}

async function loadLease(admin: SupabaseClient, leaseId: string): Promise<LeaseRow | null> {
  const { data, error } = await admin.from('leases').select(LEASE_COLUMNS).eq('id', leaseId).maybeSingle()
  if (error) throw new LeaseRequestError('Could not load that lease.', 500)
  return data ? asLeaseRow(data as unknown as LeaseQueryRow) : null
}

async function listPartyLeases(
  admin: SupabaseClient,
  filter: { landlordId?: string; tenantId: string; propertyId?: string },
): Promise<LeaseRow[]> {
  let query = admin.from('leases').select(LEASE_COLUMNS).eq('tenant_id', filter.tenantId)
  if (filter.landlordId) query = query.eq('landlord_id', filter.landlordId)
  if (filter.propertyId) query = query.eq('property_id', filter.propertyId)
  const { data, error } = await query.order('created_at', { ascending: false }).limit(20)
  if (error) throw new LeaseRequestError('Could not load leases.', 500)
  return ((data ?? []) as unknown as LeaseQueryRow[]).map(asLeaseRow)
}

async function userEmail(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error) return null
  const email = data.user?.email?.trim()
  return email || null
}

async function profileName(admin: SupabaseClient, userId: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('display_name').eq('id', userId).maybeSingle()
  const name = (data as { display_name?: string | null } | null)?.display_name?.trim()
  return name || null
}

async function emailSignedCopies(admin: SupabaseClient, lease: LeaseRow, pdf: Buffer): Promise<void> {
  const label = lease.property_label || 'your property'
  const recipients = new Set<string>()
  for (const userId of [lease.landlord_id, lease.tenant_id]) {
    const email = await userEmail(admin, userId)
    if (email) recipients.add(email.toLowerCase())
  }
  const html = `<p>The lease for ${escapeHtml(label)} is signed. A copy is attached and is also available in Rental City.</p>`
  for (const to of recipients) {
    await sendReportEmail({
      to,
      subject: `Signed lease — ${label}`.slice(0, 140),
      html,
      attachments: [{ filename: 'signed-lease.pdf', contentBase64: pdf.toString('base64') }],
    })
  }
}

async function storeSignedPdf(admin: SupabaseClient, lease: LeaseRow, pdf: Buffer, completedAt?: string): Promise<LeaseRow> {
  const path = `${lease.id}/signed.pdf`
  const { error: uploadError } = await admin.storage.from(LEASE_BUCKET).upload(path, pdf, {
    contentType: 'application/pdf',
    upsert: true,
  })
  if (uploadError) throw new LeaseRequestError('Could not store the signed lease.', 502)
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('leases')
    .update({
      signed_storage_path: path,
      envelope_status: 'completed',
      completed_at: lease.completed_at || completedAt || now,
      updated_at: now,
    })
    .eq('id', lease.id)
    .select(LEASE_COLUMNS)
    .maybeSingle()
  if (error || !data) throw new LeaseRequestError('Could not save the signed lease.', 500)
  const saved = asLeaseRow(data as unknown as LeaseQueryRow)
  if (lease.envelope_status !== 'completed') await emailSignedCopies(admin, saved, pdf)
  return saved
}

async function persistStatus(admin: SupabaseClient, lease: LeaseRow, status: string, completedAt?: string): Promise<LeaseRow> {
  if (lease.envelope_status === status && (!completedAt || lease.completed_at)) return lease
  const now = new Date().toISOString()
  const { data, error } = await admin
    .from('leases')
    .update({
      envelope_status: status,
      completed_at: status === 'completed' ? (lease.completed_at || completedAt || now) : lease.completed_at,
      updated_at: now,
    })
    .eq('id', lease.id)
    .select(LEASE_COLUMNS)
    .maybeSingle()
  if (error || !data) return lease
  return asLeaseRow(data as unknown as LeaseQueryRow)
}

/** Re-read DocuSign. Returns null when the live status cannot be read (other than a missing envelope). */
async function liveStatus(envelopeId: string): Promise<{ status: string; completedAt?: string } | null> {
  try {
    return await getEnvelopeStatus(envelopeId)
  } catch (err) {
    if (isDocuSignNotFound(err)) return { status: 'voided' }
    console.error('DocuSign lease status error:', err instanceof Error ? err.message : String(err))
    return null
  }
}

async function reconcileLease(admin: SupabaseClient, lease: LeaseRow, strict: boolean): Promise<LeaseRow> {
  if (!lease.envelope_id) return lease
  if (lease.envelope_status === 'completed' && lease.signed_storage_path) return lease
  if (lease.envelope_status === 'voided') return lease
  const live = await liveStatus(lease.envelope_id)
  if (!live) {
    if (strict) throw new LeaseRequestError('Could not check the lease with DocuSign. Try again before sending another.', 502)
    return lease
  }
  if (shouldStoreSignedPdf(live.status)) {
    if (lease.signed_storage_path && lease.envelope_status === 'completed') return lease
    const pdf = await downloadCompletedDocument(lease.envelope_id)
    return storeSignedPdf(admin, lease, pdf, live.completedAt)
  }
  return persistStatus(admin, lease, live.status, live.completedAt)
}

async function retireOpenLeases(admin: SupabaseClient, rows: LeaseRow[]): Promise<void> {
  for (const row of rows) {
    if (!shouldVoidExistingLease(row.envelope_status)) continue
    const current = await reconcileLease(admin, row, true)
    if (!shouldVoidExistingLease(current.envelope_status)) continue
    if (current.envelope_id && current.envelope_status !== 'voided' && current.envelope_status !== 'declined') {
      try {
        await voidEnvelope(current.envelope_id, LEASE_VOID_REASON)
      } catch (err) {
        if (!isDocuSignNotFound(err)) {
          throw new LeaseRequestError('Could not replace the unsigned lease. Try again.', 502)
        }
      }
    }
    await persistStatus(admin, current, 'voided')
  }
}

export async function completeLeaseEnvelope(
  admin: SupabaseClient,
  userId: string,
  envelopeId: string,
): Promise<{ completed: boolean; status: string }> {
  const { data, error } = await admin
    .from('leases')
    .select(LEASE_COLUMNS)
    .eq('envelope_id', envelopeId)
    .eq('tenant_id', userId)
    .maybeSingle()
  if (error) throw new LeaseRequestError('Could not load that lease.', 500)
  if (!data) throw new LeaseRequestError('This envelope does not belong to your account.', 403)
  const lease = await reconcileLease(admin, asLeaseRow(data as unknown as LeaseQueryRow), true)
  return { completed: lease.envelope_status === 'completed', status: lease.envelope_status }
}

function pdfParser(req: Request, res: Response, next: express.NextFunction) {
  express.raw({ type: 'application/pdf', limit: LEASE_PDF_MAX_BYTES })(req, res, (err: unknown) => {
    if (err) {
      res.status(413).json({ error: 'That PDF is too large. Upload a file under 8 MB.' })
      return
    }
    next()
  })
}

export function registerLeaseRoutes(app: express.Express): void {
  app.get('/api/leases/mine', async (req, res) => {
    try {
      const user = await bearerUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      const admin = getAdmin()
      if (!admin) return res.status(500).json({ error: 'Server configuration error' })
      const rows = await listPartyLeases(admin, { tenantId: user.id })
      const reconciled: LeaseRow[] = []
      for (const row of rows) {
        if (leaseIsOpen(row.envelope_status) || (row.envelope_status === 'completed' && !row.signed_storage_path)) {
          reconciled.push(await reconcileLease(admin, row, false))
        } else {
          reconciled.push(row)
        }
      }
      const action = reconciled.find((row) => row.envelope_status === 'sent' || row.envelope_status === 'delivered') ?? null
      const completed = reconciled.filter((row) => row.envelope_status === 'completed')
      return res.json({
        action: action ? leasePublicView(action) : null,
        completed: completed.map(leasePublicView),
      })
    } catch (err) {
      return sendLeaseError(res, err)
    }
  })

  app.get('/api/leases', async (req, res) => {
    try {
      const user = await bearerUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      const admin = getAdmin()
      if (!admin) return res.status(500).json({ error: 'Server configuration error' })
      const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : ''
      const tenantId = typeof req.query.tenantId === 'string' ? req.query.tenantId : ''
      if (!UUID_RE.test(propertyId) || !UUID_RE.test(tenantId)) {
        return res.status(400).json({ error: 'Choose a tenant and property.' })
      }
      const { data: property, error: propertyError } = await admin
        .from('properties')
        .select('id, landlord_id')
        .eq('id', propertyId)
        .maybeSingle()
      if (propertyError) return res.status(500).json({ error: 'Could not load that property.' })
      if (!property || property.landlord_id !== user.id) {
        return res.status(403).json({ error: 'You can only view leases for your own property.' })
      }
      const rows = await listPartyLeases(admin, { landlordId: user.id, tenantId, propertyId })
      const current = pickCurrentLease(rows)
      const lease = current ? await reconcileLease(admin, current, false) : null
      return res.json({ lease: lease ? leasePublicView(lease) : null })
    } catch (err) {
      return sendLeaseError(res, err)
    }
  })

  app.post('/api/leases', pdfParser, async (req, res) => {
    let createdEnvelopeId: string | null = null
    let originalPath: string | null = null
    const admin = getAdmin()
    try {
      const user = await bearerUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      if (!admin) return res.status(500).json({ error: 'Server configuration error' })
      const propertyId = headerValue(req, 'x-lease-property-id')
      const tenantId = headerValue(req, 'x-lease-tenant-id')
      const requestedApplicationId = headerValue(req, 'x-lease-application-id')
      if (!UUID_RE.test(propertyId) || !UUID_RE.test(tenantId)) {
        return res.status(400).json({ error: 'Choose a tenant and property.' })
      }
      if (requestedApplicationId && !UUID_RE.test(requestedApplicationId)) {
        return res.status(400).json({ error: 'That application is not valid.' })
      }
      const bytes = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0)
      assertLeasePdf(bytes)
      const placement = await leaseSignaturePlacement(bytes)

      const { data: property, error: propertyError } = await admin
        .from('properties')
        .select('id, landlord_id, title, address_line1, city')
        .eq('id', propertyId)
        .maybeSingle()
      if (propertyError) return res.status(500).json({ error: 'Could not load that property.' })
      if (!property) return res.status(404).json({ error: 'Property not found.' })

      const nowIso = new Date().toISOString()
      const [applicationResult, threadResult, inviteResult] = await Promise.all([
        admin.from('applications').select('id').eq('tenant_id', tenantId).eq('property_id', propertyId).maybeSingle(),
        admin.from('message_threads').select('id').eq('tenant_id', tenantId).eq('landlord_id', user.id).limit(1),
        admin
          .from('tenant_invite_restrictions')
          .select('tenant_id')
          .eq('tenant_id', tenantId)
          .eq('landlord_id', user.id)
          .gt('ends_at', nowIso)
          .limit(1),
      ])
      if (applicationResult.error || threadResult.error || inviteResult.error) {
        return res.status(500).json({ error: 'Could not confirm this tenant.' })
      }
      const applicationId = (applicationResult.data as { id?: string } | null)?.id ?? null
      if (requestedApplicationId && requestedApplicationId !== applicationId) {
        return res.status(400).json({ error: 'That application is not for this tenant and property.' })
      }
      const allowed = landlordMaySendLease({
        callerOwnsProperty: property.landlord_id === user.id,
        applicationOnProperty: Boolean(applicationId),
        messageThreadWithLandlord: (threadResult.data?.length ?? 0) > 0,
        activeInvite: (inviteResult.data?.length ?? 0) > 0,
      })
      if (!allowed) return res.status(403).json({ error: 'You can only send a lease to a tenant connected with you on your property.' })

      const tenantEmail = await userEmail(admin, tenantId)
      if (!tenantEmail) return res.status(400).json({ error: 'That tenant does not have an email address yet.' })
      const tenantName = (await profileName(admin, tenantId)) || tenantEmail.split('@')[0] || 'Tenant'
      const label = propertyLeaseLabel(property as { title?: string | null; address_line1?: string | null; city?: string | null })

      const existing = await listPartyLeases(admin, { landlordId: user.id, tenantId, propertyId })
      await retireOpenLeases(admin, existing.filter((row) => shouldVoidExistingLease(row.envelope_status)))

      const leaseId = crypto.randomUUID()
      originalPath = `${leaseId}/original.pdf`
      const { error: uploadError } = await admin.storage.from(LEASE_BUCKET).upload(originalPath, bytes, {
        contentType: 'application/pdf',
        upsert: false,
      })
      if (uploadError) return res.status(502).json({ error: 'Could not store the lease PDF.' })

      const origin = returnOrigin(req)
      const returnUrl = `${origin}/docusign/return?type=lease`
      try {
        createdEnvelopeId = await createEmbeddedEnvelope({
          documentBase64: bytes.toString('base64'),
          documentName: 'Lease.pdf',
          fileExtension: 'pdf',
          transformPdfFields: false,
          emailSubject: leaseEmailSubject(label),
          signer: { name: tenantName, email: tenantEmail, clientUserId: tenantId },
          tabs: leaseSignatureTabs(placement),
          returnUrl,
        })
      } catch (err) {
        console.error('DocuSign lease envelope error:', err instanceof Error ? err.message : String(err))
        throw new LeaseRequestError('Could not send the lease for signature.', 502)
      }
      logLeaseEnvelopeCreated(leaseId, createdEnvelopeId)

      const sentAt = new Date().toISOString()
      const { data: inserted, error: insertError } = await admin
        .from('leases')
        .insert({
          id: leaseId,
          landlord_id: user.id,
          tenant_id: tenantId,
          property_id: propertyId,
          application_id: applicationId,
          original_storage_path: originalPath,
          signed_storage_path: null,
          envelope_id: createdEnvelopeId,
          envelope_status: 'sent',
          sent_at: sentAt,
          completed_at: null,
          updated_at: sentAt,
        })
        .select(LEASE_COLUMNS)
        .maybeSingle()
      if (insertError || !inserted) {
        const code = (insertError as { code?: string } | null)?.code
        throw new LeaseRequestError(
          code === '23505'
            ? 'A lease is already in progress for this tenant and property.'
            : 'Could not save the lease.',
          code === '23505' ? 409 : 500,
        )
      }
      const saved = asLeaseRow(inserted as unknown as LeaseQueryRow)
      saved.property_label = label
      return res.status(201).json({ lease: leasePublicView(saved) })
    } catch (err) {
      if (createdEnvelopeId) {
        try {
          await voidEnvelope(createdEnvelopeId, LEASE_VOID_REASON)
        } catch (voidErr) {
          console.error('Could not void lease envelope after a failed save:', voidErr instanceof Error ? voidErr.message : String(voidErr))
        }
      }
      if (originalPath && admin) {
        await admin.storage.from(LEASE_BUCKET).remove([originalPath]).catch(() => undefined)
      }
      return sendLeaseError(res, err)
    }
  })

  app.post('/api/leases/:id/signing-session', async (req, res) => {
    try {
      const user = await bearerUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      const admin = getAdmin()
      if (!admin) return res.status(500).json({ error: 'Server configuration error' })
      if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'That lease is not valid.' })
      const lease = await loadLease(admin, req.params.id)
      if (!lease || lease.tenant_id !== user.id) {
        return res.status(403).json({ error: 'Only the tenant named on this lease can sign it.' })
      }
      if (!lease.envelope_id) return res.status(409).json({ error: 'This lease has not been sent yet.' })
      const current = await reconcileLease(admin, lease, true)
      if (current.envelope_status === 'completed') {
        return res.status(409).json({ error: 'This lease is already signed.' })
      }
      if (!leaseIsOpen(current.envelope_status) || !current.envelope_id) {
        return res.status(409).json({ error: 'This lease is no longer waiting for a signature.' })
      }
      const email = user.email || await userEmail(admin, user.id)
      if (!email) return res.status(400).json({ error: 'Add an email to your account before signing.' })
      const name = (await profileName(admin, user.id)) || email.split('@')[0] || 'Tenant'
      const signingUrl = await createEmbeddedSigningUrl(
        current.envelope_id,
        { name, email, clientUserId: user.id },
        leaseReturnUrl(returnOrigin(req), current.envelope_id),
      )
      return res.json({ envelopeId: current.envelope_id, signingUrl })
    } catch (err) {
      if (err instanceof LeaseRequestError) return sendLeaseError(res, err)
      console.error('DocuSign lease signing URL error:', err instanceof Error ? err.message : String(err))
      return res.status(502).json({ error: 'Could not open the signing session.' })
    }
  })

  app.get('/api/leases/:id/document', async (req, res) => {
    try {
      const user = await bearerUser(req)
      if (!user) return res.status(401).json({ error: 'Unauthorized' })
      const admin = getAdmin()
      if (!admin) return res.status(500).json({ error: 'Server configuration error' })
      if (!UUID_RE.test(req.params.id)) return res.status(400).json({ error: 'That lease is not valid.' })
      const copy = req.query.copy === 'signed' ? 'signed' : req.query.copy === 'original' ? 'original' : ''
      if (!copy) return res.status(400).json({ error: 'Choose the original or signed copy.' })
      const lease = await loadLease(admin, req.params.id)
      if (!lease || !callerMayDownloadLease(lease, user.id)) {
        return res.status(403).json({ error: 'You cannot download this lease.' })
      }
      const path = copy === 'signed' ? lease.signed_storage_path : lease.original_storage_path
      if (!path) return res.status(404).json({ error: copy === 'signed' ? 'The signed lease is not ready yet.' : 'The original lease is not available.' })
      const { data, error } = await admin.storage.from(LEASE_BUCKET).download(path)
      if (error || !data) return res.status(404).json({ error: 'Could not download that lease.' })
      const bytes = Buffer.isBuffer(data) ? data : Buffer.from(await data.arrayBuffer())
      res.setHeader('Content-Type', 'application/pdf')
      res.setHeader('Content-Disposition', `attachment; filename="${copy === 'signed' ? 'signed-lease.pdf' : 'lease.pdf'}"`)
      res.setHeader('Cache-Control', 'private, no-store')
      return res.send(bytes)
    } catch (err) {
      return sendLeaseError(res, err)
    }
  })
}

function headerValue(req: Request, name: string): string {
  const value = req.headers[name]
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? ''
}
