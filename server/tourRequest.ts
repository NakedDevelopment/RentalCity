import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendReportEmail, type SendEmailArgs } from './email'

export const TOUR_REQUEST_LIMIT = 3
export const TOUR_REQUEST_WINDOW_MS = 60 * 60 * 1000
export const TOUR_DEDUPE_WINDOW_MS = 2 * 60 * 1000

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type TourListing = {
  id: string
  landlordId: string
  status: string
  addressLine1: string
  addressLine2: string | null
  city: string
  state: string | null
  postalCode: string | null
}

export type StoredTourRequest = {
  id: string
  propertyId: string
  tenantId: string
  email: string
  message: string
  preferredTime: string | null
  createdAt: string
}

export type TourInsert = {
  propertyId: string
  landlordId: string
  tenantId: string
  tenantEmail: string
  tenantName: string
  tenantPhone: string | null
  preferredTime: string | null
  message: string
  dedupeKey: string
  hourBucket: string
  slot: number
}

export type TourStore = {
  getListing(propertyId: string): Promise<TourListing | null>
  landlordEmail(landlordId: string): Promise<string | null>
  recentRequests(propertyId: string, sinceIso: string): Promise<StoredTourRequest[]>
  insert(row: TourInsert): Promise<{ id: string } | { conflict: 'dedupe' | 'slot' }>
  remove(id: string): Promise<void>
}

export type NormalizedTourRequest = {
  propertyId: string
  name: string
  email: string
  phone: string | null
  preferredTime: string | null
  message: string
}

export type TourHttpResult = {
  status: number
  body: { ok: true; confirmationSent: boolean } | { error: string }
}

type SendEmail = (args: SendEmailArgs) => Promise<boolean>

function text(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export function parseTourRequestBody(body: unknown): { ok: true; value: NormalizedTourRequest } | { ok: false; error: string } {
  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const propertyId = text(record.propertyId, 80)
  const name = text(record.name, 120)
  const email = text(record.email, 200).toLowerCase()
  const phoneRaw = text(record.phone, 40)
  const preferredRaw = text(record.preferredTime, 120)
  const message = text(record.message, 2000)
  if (!UUID_RE.test(propertyId)) return { ok: false, error: 'Choose a listing first.' }
  if (!name) return { ok: false, error: 'Name is required.' }
  if (!EMAIL_RE.test(email)) return { ok: false, error: 'Enter a valid email address.' }
  if (!message) return { ok: false, error: 'Message is required.' }
  return {
    ok: true,
    value: {
      propertyId,
      name,
      email,
      phone: phoneRaw || null,
      preferredTime: preferredRaw || null,
      message,
    },
  }
}

export function formatListingAddress(listing: Pick<TourListing, 'addressLine1' | 'addressLine2' | 'city' | 'state' | 'postalCode'>): string {
  const street = [listing.addressLine1, listing.addressLine2].map((part) => part?.trim()).filter(Boolean).join(', ')
  const region = [listing.state?.trim(), listing.postalCode?.trim()].filter(Boolean).join(' ')
  const cityLine = [listing.city?.trim(), region].filter(Boolean).join(', ')
  return [street, cityLine].filter(Boolean).join(', ')
}

export function listingUrl(appUrl: string, propertyId: string): string {
  return `${appUrl.replace(/\/$/, '')}/property/${propertyId}`
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function tourDedupeKey(tenantId: string, message: string, preferredTime: string | null, now: number): string {
  const bucket = Math.floor(now / TOUR_DEDUPE_WINDOW_MS)
  return createHash('sha256')
    .update(`${tenantId}\n${message.trim()}\n${(preferredTime ?? '').trim()}\n${bucket}`)
    .digest('hex')
}

export function hourBucketIso(now: number): string {
  return new Date(Math.floor(now / TOUR_REQUEST_WINDOW_MS) * TOUR_REQUEST_WINDOW_MS).toISOString()
}

export function decideTourRequest(
  recent: StoredTourRequest[],
  next: { tenantId: string; email: string; message: string; preferredTime: string | null },
  now: number,
): 'ok' | 'duplicate' | 'rate_limited' {
  const email = next.email.trim().toLowerCase()
  const message = next.message.trim()
  const preferred = (next.preferredTime ?? '').trim()
  const related = recent.filter((row) => {
    const age = now - Date.parse(row.createdAt)
    if (!Number.isFinite(age) || age < 0 || age >= TOUR_REQUEST_WINDOW_MS) return false
    return row.tenantId === next.tenantId || row.email.trim().toLowerCase() === email
  })
  if (related.length >= TOUR_REQUEST_LIMIT) return 'rate_limited'
  const duplicate = related.some(
    (row) =>
      row.tenantId === next.tenantId &&
      row.message.trim() === message &&
      (row.preferredTime ?? '').trim() === preferred &&
      now - Date.parse(row.createdAt) < TOUR_DEDUPE_WINDOW_MS,
  )
  return duplicate ? 'duplicate' : 'ok'
}

function emailLayout(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background-color:#0F1E3D;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">Rental City</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">${esc(title)}</p>
            ${bodyHtml}
            <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— The Rental City Team</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export function buildLandlordTourEmail(params: {
  address: string
  listingLink: string
  name: string
  email: string
  phone: string | null
  preferredTime: string | null
  message: string
}): { subject: string; html: string } {
  const rows = [
    ['Listing', params.address],
    ['Name', params.name],
    ['Email', params.email],
    ['Phone', params.phone || 'Not provided'],
    ['Preferred date and time', params.preferredTime || 'Not provided'],
  ]
  const details = rows
    .map(
      ([label, value]) =>
        `<p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>${esc(label)}:</strong> ${esc(value)}</p>`,
    )
    .join('')
  return {
    subject: `Tour request for ${params.address}`.slice(0, 180),
    html: emailLayout(
      'A tenant requested a tour',
      `${details}
       <p style="margin:16px 0 8px;font-size:14px;color:#374151;"><strong>Message:</strong></p>
       <div style="border-left:3px solid #3A7AFE;padding:8px 16px;background-color:#f9fafb;">
         <p style="margin:0;font-size:14px;line-height:22px;color:#374151;white-space:pre-wrap;">${esc(params.message)}</p>
       </div>
       <p style="margin:16px 0 0;font-size:14px;color:#374151;"><a href="${esc(params.listingLink)}">View the listing</a></p>`,
    ),
  }
}

export function buildTenantTourConfirmation(params: {
  address: string
  listingLink: string
  name: string
}): { subject: string; html: string } {
  return {
    subject: `We sent your tour request for ${params.address}`.slice(0, 180),
    html: emailLayout(
      `Hi ${params.name}, your tour request was sent`,
      `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#374151;">The landlord for ${esc(params.address)} has your request. This note confirms we emailed them. There is no in-app thread for this request.</p>
       <p style="margin:0;font-size:14px;color:#374151;"><a href="${esc(params.listingLink)}">View the listing</a></p>`,
    ),
  }
}

function slotFor(recent: StoredTourRequest[], tenantId: string, now: number): number {
  return recent.filter((row) => {
    const age = now - Date.parse(row.createdAt)
    return row.tenantId === tenantId && Number.isFinite(age) && age >= 0 && age < TOUR_REQUEST_WINDOW_MS
  }).length + 1
}

export async function submitListingTourRequest(
  store: TourStore,
  tenant: { id: string },
  body: unknown,
  send: SendEmail = sendReportEmail,
  appUrl: string,
  now = Date.now(),
): Promise<TourHttpResult> {
  const parsed = parseTourRequestBody(body)
  if (!parsed.ok) return { status: 400, body: { error: parsed.error } }

  const listing = await store.getListing(parsed.value.propertyId)
  if (!listing || listing.status !== 'active') {
    return { status: 404, body: { error: 'Listing not found.' } }
  }

  const since = new Date(now - TOUR_REQUEST_WINDOW_MS).toISOString()
  const recent = await store.recentRequests(listing.id, since)
  const decision = decideTourRequest(recent, { tenantId: tenant.id, ...parsed.value }, now)
  if (decision === 'duplicate') {
    return { status: 409, body: { error: 'You already sent this request.' } }
  }
  if (decision === 'rate_limited') {
    return { status: 429, body: { error: 'You can send 3 tour requests for this listing per hour.' } }
  }

  const landlordEmail = await store.landlordEmail(listing.landlordId)
  if (!landlordEmail || !EMAIL_RE.test(landlordEmail)) {
    return { status: 404, body: { error: 'This listing is not accepting tour requests right now.' } }
  }

  const inserted = await store.insert({
    propertyId: listing.id,
    landlordId: listing.landlordId,
    tenantId: tenant.id,
    tenantEmail: parsed.value.email,
    tenantName: parsed.value.name,
    tenantPhone: parsed.value.phone,
    preferredTime: parsed.value.preferredTime,
    message: parsed.value.message,
    dedupeKey: tourDedupeKey(tenant.id, parsed.value.message, parsed.value.preferredTime, now),
    hourBucket: hourBucketIso(now),
    slot: slotFor(recent, tenant.id, now),
  })
  if ('conflict' in inserted) {
    if (inserted.conflict === 'dedupe') {
      return { status: 409, body: { error: 'You already sent this request.' } }
    }
    const again = await store.recentRequests(listing.id, since)
    const retry = decideTourRequest(again, { tenantId: tenant.id, ...parsed.value }, now)
    if (retry !== 'ok') {
      return {
        status: retry === 'duplicate' ? 409 : 429,
        body: { error: retry === 'duplicate' ? 'You already sent this request.' : 'You can send 3 tour requests for this listing per hour.' },
      }
    }
    const second = await store.insert({
      propertyId: listing.id,
      landlordId: listing.landlordId,
      tenantId: tenant.id,
      tenantEmail: parsed.value.email,
      tenantName: parsed.value.name,
      tenantPhone: parsed.value.phone,
      preferredTime: parsed.value.preferredTime,
      message: parsed.value.message,
      dedupeKey: tourDedupeKey(tenant.id, parsed.value.message, parsed.value.preferredTime, now),
      hourBucket: hourBucketIso(now),
      slot: slotFor(again, tenant.id, now),
    })
    if ('conflict' in second) {
      return { status: 429, body: { error: 'You can send 3 tour requests for this listing per hour.' } }
    }
    return deliver(store, second.id, listing, parsed.value, landlordEmail, send, appUrl)
  }

  return deliver(store, inserted.id, listing, parsed.value, landlordEmail, send, appUrl)
}

async function deliver(
  store: TourStore,
  requestId: string,
  listing: TourListing,
  value: NormalizedTourRequest,
  landlordEmail: string,
  send: SendEmail,
  appUrl: string,
): Promise<TourHttpResult> {
  const address = formatListingAddress(listing)
  const link = listingUrl(appUrl, listing.id)
  const landlordMail = buildLandlordTourEmail({
    address,
    listingLink: link,
    name: value.name,
    email: value.email,
    phone: value.phone,
    preferredTime: value.preferredTime,
    message: value.message,
  })
  const landlordSent = await send({
    to: landlordEmail,
    subject: landlordMail.subject,
    html: landlordMail.html,
    replyTo: { email: value.email, name: value.name },
  })
  if (!landlordSent) {
    await store.remove(requestId)
    return { status: 502, body: { error: "We couldn't send your request. Please try again." } }
  }

  const confirmation = buildTenantTourConfirmation({ address, listingLink: link, name: value.name })
  const confirmationSent = await send({
    to: value.email,
    subject: confirmation.subject,
    html: confirmation.html,
  })
  return { status: 200, body: { ok: true, confirmationSent } }
}

type Row = {
  id: string
  tenant_id: string
  tenant_email: string
  message: string
  preferred_time: string | null
  created_at: string
}

function conflictKind(error: { code?: string; message?: string; details?: string | null }): 'dedupe' | 'slot' | null {
  if (error.code !== '23505') return null
  const text = `${error.message ?? ''} ${error.details ?? ''}`
  if (text.includes('dedupe')) return 'dedupe'
  return 'slot'
}

export function supabaseTourStore(admin: SupabaseClient): TourStore {
  return {
    async getListing(propertyId) {
      const { data, error } = await admin
        .from('properties')
        .select('id, landlord_id, status, address_line1, address_line2, city, state, postal_code')
        .eq('id', propertyId)
        .maybeSingle()
      if (error || !data) return null
      const row = data as {
        id: string
        landlord_id: string
        status: string
        address_line1: string
        address_line2: string | null
        city: string
        state: string | null
        postal_code: string | null
      }
      return {
        id: row.id,
        landlordId: row.landlord_id,
        status: row.status,
        addressLine1: row.address_line1,
        addressLine2: row.address_line2,
        city: row.city,
        state: row.state,
        postalCode: row.postal_code,
      }
    },
    async landlordEmail(landlordId) {
      const { data, error } = await admin.auth.admin.getUserById(landlordId)
      if (error) return null
      return data.user?.email ?? null
    },
    async recentRequests(propertyId, sinceIso) {
      const { data, error } = await admin
        .from('listing_tour_requests')
        .select('id, tenant_id, tenant_email, message, preferred_time, created_at')
        .eq('property_id', propertyId)
        .gte('created_at', sinceIso)
      if (error || !data) return []
      return (data as Row[]).map((row) => ({
        id: row.id,
        propertyId,
        tenantId: row.tenant_id,
        email: row.tenant_email,
        message: row.message,
        preferredTime: row.preferred_time,
        createdAt: row.created_at,
      }))
    },
    async insert(row) {
      const { data, error } = await admin
        .from('listing_tour_requests')
        .insert({
          property_id: row.propertyId,
          landlord_id: row.landlordId,
          tenant_id: row.tenantId,
          tenant_email: row.tenantEmail,
          tenant_name: row.tenantName,
          tenant_phone: row.tenantPhone,
          preferred_time: row.preferredTime,
          message: row.message,
          dedupe_key: row.dedupeKey,
          hour_bucket: row.hourBucket,
          slot: row.slot,
        })
        .select('id')
        .single()
      if (error) {
        const kind = conflictKind(error)
        if (kind) return { conflict: kind }
        throw new Error(error.message)
      }
      return { id: (data as { id: string }).id }
    },
    async remove(id) {
      await admin.from('listing_tour_requests').delete().eq('id', id)
    },
  }
}
