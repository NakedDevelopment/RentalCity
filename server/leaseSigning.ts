import { PDFDocument } from 'pdf-lib'
import type { AnchorTab } from './docusign'

export const LEASE_PDF_MAX_BYTES = 8 * 1024 * 1024
export const LEASE_VOID_REASON = 'Replaced with a new lease PDF before signing'
export const LEASE_BUCKET = 'leases'

export class LeaseRequestError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'LeaseRequestError'
    this.status = status
  }
}

export type LeaseRow = {
  id: string
  landlord_id: string
  tenant_id: string
  property_id: string
  application_id: string | null
  original_storage_path: string | null
  signed_storage_path: string | null
  envelope_id: string | null
  envelope_status: string
  sent_at: string | null
  completed_at: string | null
  created_at: string
  property_label?: string | null
}

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

export type LeasePagePlacement = {
  pageNumber: number
  width: number
  height: number
  signX: number
  signY: number
  dateX: number
  dateY: number
}

const TERMINAL_STATUSES = new Set(['completed', 'declined', 'voided'])

export function assertLeasePdf(bytes: Buffer): void {
  if (!bytes.length) throw new LeaseRequestError('Choose a PDF lease to upload.', 400)
  if (bytes.length > LEASE_PDF_MAX_BYTES) {
    throw new LeaseRequestError('That PDF is too large. Upload a file under 8 MB.', 400)
  }
  if (bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    throw new LeaseRequestError('Upload a PDF file.', 400)
  }
}

export async function leaseSignaturePlacement(bytes: Buffer): Promise<LeasePagePlacement> {
  assertLeasePdf(bytes)
  let pdf: PDFDocument
  try {
    pdf = await PDFDocument.load(bytes)
  } catch {
    throw new LeaseRequestError('That file is not a readable PDF.', 400)
  }
  let pageCount = 0
  let width = 0
  let height = 0
  try {
    pageCount = pdf.getPageCount()
    if (pageCount < 1) throw new Error('no pages')
    const page = pdf.getPage(pageCount - 1)
    const size = page.getSize()
    width = size.width
    height = size.height
  } catch {
    throw new LeaseRequestError('That file is not a readable PDF.', 400)
  }
  const signX = 48
  const signY = Math.max(48, Math.round(height - 120))
  const dateX = Math.min(Math.round(width - 150), signX + 220)
  const dateY = signY
  if (signX < 0 || dateX < 0 || signY < 0 || signX >= width || dateX >= width || signY >= height) {
    throw new LeaseRequestError('That PDF page is too small for a signature.', 400)
  }
  return { pageNumber: pageCount, width, height, signX, signY, dateX, dateY }
}

/** Required signature and date on the last page. Uploaded leases have no anchor text. */
export function leaseSignatureTabs(placement: LeasePagePlacement): AnchorTab[] {
  const pageNumber = String(placement.pageNumber)
  return [
    {
      type: 'sign',
      documentId: '1',
      pageNumber,
      xPosition: String(placement.signX),
      yPosition: String(placement.signY),
      required: true,
      tabLabel: 'Tenant signature',
    },
    {
      type: 'dateSigned',
      documentId: '1',
      pageNumber,
      xPosition: String(placement.dateX),
      yPosition: String(placement.dateY),
      required: true,
      tabLabel: 'Date signed',
    },
  ]
}

export function leaseEmailSubject(propertyLabel: string): string {
  const label = propertyLabel.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || 'your property'
  return `Rental City lease for ${label}`.slice(0, 100)
}

export function leaseReturnUrl(origin: string, envelopeId: string): string {
  const url = new URL('/docusign/return', origin)
  url.searchParams.set('type', 'lease')
  url.searchParams.set('envelopeId', envelopeId)
  return url.toString()
}

export function leaseStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case 'sent':
      return 'Sent'
    case 'delivered':
      return 'Viewed'
    case 'completed':
      return 'Signed'
    case 'declined':
      return 'Declined'
    case 'voided':
      return 'Voided'
    case null:
    case undefined:
    case '':
      return 'Not sent'
    default:
      return status
  }
}

export function shouldStoreSignedPdf(status: string): boolean {
  return status === 'completed'
}

export function leaseIsOpen(status: string): boolean {
  return !TERMINAL_STATUSES.has(status)
}

/** Never void a completed envelope. Declined and voided envelopes are already finished. */
export function shouldVoidExistingLease(status: string): boolean {
  return status !== 'completed' && status !== 'declined' && status !== 'voided'
}

export function landlordMaySendLease(input: {
  callerOwnsProperty: boolean
  applicationOnProperty: boolean
  messageThreadWithLandlord: boolean
  activeInvite: boolean
}): boolean {
  if (!input.callerOwnsProperty) return false
  return input.applicationOnProperty || input.messageThreadWithLandlord || input.activeInvite
}

export function callerMayDownloadLease(
  row: { landlord_id: string; tenant_id: string },
  userId: string,
): boolean {
  return userId.length > 0 && (row.landlord_id === userId || row.tenant_id === userId)
}

export function leasePublicView(row: LeaseRow): LeaseView {
  return {
    id: row.id,
    landlordId: row.landlord_id,
    tenantId: row.tenant_id,
    propertyId: row.property_id,
    applicationId: row.application_id,
    status: row.envelope_status,
    statusLabel: leaseStatusLabel(row.envelope_status),
    sentAt: row.sent_at,
    completedAt: row.completed_at,
    hasOriginal: Boolean(row.original_storage_path),
    hasSigned: Boolean(row.signed_storage_path),
    propertyLabel: row.property_label ?? null,
  }
}

export function pickCurrentLease<T extends { envelope_status: string; created_at: string }>(rows: T[]): T | null {
  const sorted = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
  return sorted.find((row) => leaseIsOpen(row.envelope_status))
    ?? sorted.find((row) => row.envelope_status !== 'voided')
    ?? sorted[0]
    ?? null
}

/** Count a successful lease envelope create. Do not call this from tests that talk to DocuSign. */
export function logLeaseEnvelopeCreated(leaseId: string, envelopeId: string, at: Date = new Date()): void {
  console.info(`lease_envelope_created leaseId=${leaseId} envelopeId=${envelopeId} at=${at.toISOString()}`)
}

export function isDocuSignNotFound(error: unknown): boolean {
  const err = error as {
    status?: number
    statusCode?: number
    response?: { status?: number; statusCode?: number }
    message?: string
  }
  return (
    err.status === 404 ||
    err.statusCode === 404 ||
    err.response?.status === 404 ||
    err.response?.statusCode === 404 ||
    /status code 404/i.test(err.message ?? '')
  )
}

export function propertyLeaseLabel(property: {
  title?: string | null
  address_line1?: string | null
  city?: string | null
}): string {
  const title = property.title?.trim()
  if (title) return title
  return [property.address_line1, property.city].filter((part) => part && part.trim()).join(', ') || 'your property'
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] ?? char
  ))
}
