import assert from 'node:assert/strict'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import { buildEmbeddedEnvelopeDefinition } from './docusign'
import {
  LEASE_PDF_MAX_BYTES,
  LEASE_VOID_REASON,
  assertLeasePdf,
  callerMayDownloadLease,
  landlordMaySendLease,
  leaseEmailSubject,
  leasePublicView,
  leaseReturnUrl,
  leaseSignaturePlacement,
  leaseSignatureTabs,
  leaseStatusLabel,
  logLeaseEnvelopeCreated,
  pickCurrentLease,
  shouldStoreSignedPdf,
  shouldVoidExistingLease,
  type LeaseRow,
} from './leaseSigning'

async function samplePdf(pages: Array<[number, number]>): Promise<Buffer> {
  const doc = await PDFDocument.create()
  for (const [width, height] of pages) doc.addPage([width, height])
  return Buffer.from(await doc.save())
}

test('lease upload rejects empty, non-pdf, and oversized files', () => {
  assert.throws(() => assertLeasePdf(Buffer.alloc(0)), /Choose a PDF/)
  assert.throws(() => assertLeasePdf(Buffer.from('not a pdf')), /Upload a PDF/)
  const huge = Buffer.alloc(LEASE_PDF_MAX_BYTES + 1)
  huge.write('%PDF-')
  assert.throws(() => assertLeasePdf(huge), /too large/)
  assert.doesNotThrow(() => assertLeasePdf(Buffer.from('%PDF-1.7\n')))
})

test('lease signature tabs sit on the last page', async () => {
  const bytes = await samplePdf([[612, 792], [500, 640]])
  const placement = await leaseSignaturePlacement(bytes)
  assert.equal(placement.pageNumber, 2)
  assert.equal(placement.width, 500)
  assert.ok(placement.signX >= 0 && placement.signX < placement.width)
  assert.ok(placement.signY >= 0 && placement.signY < placement.height)
  assert.ok(placement.dateX >= 0 && placement.dateX < placement.width)
  const tabs = leaseSignatureTabs(placement)
  assert.equal(tabs.length, 2)
  assert.equal(tabs[0].type, 'sign')
  assert.equal(tabs[1].type, 'dateSigned')
  assert.ok(tabs.every((tab) => tab.pageNumber === '2' && tab.documentId === '1' && tab.required === true))
  assert.ok(tabs.every((tab) => !tab.anchorString))
  await assert.rejects(() => leaseSignaturePlacement(Buffer.from('%PDF-1.7\nnot really')), /readable PDF/)
})

test('lease email subject names the property', () => {
  assert.equal(leaseEmailSubject('  Harbor House '), 'Rental City lease for Harbor House')
  assert.equal(leaseEmailSubject('Line\nTwo'), 'Rental City lease for Line Two')
  assert.equal(leaseEmailSubject('   '), 'Rental City lease for your property')
  assert.ok(leaseEmailSubject('x'.repeat(200)).length <= 100)
})

test('lease envelope uses the uploaded PDF as document 1', async () => {
  const bytes = await samplePdf([[612, 792]])
  const placement = await leaseSignaturePlacement(bytes)
  const envelope = buildEmbeddedEnvelopeDefinition({
    documentBase64: bytes.toString('base64'),
    documentName: 'Lease.pdf',
    fileExtension: 'pdf',
    transformPdfFields: false,
    emailSubject: leaseEmailSubject('Harbor House'),
    signer: { name: 'Ada Tenant', email: 'ada@example.com', clientUserId: 'tenant-profile-id' },
    tabs: leaseSignatureTabs(placement),
    returnUrl: leaseReturnUrl('https://app.example.com', 'env-123'),
  })
  assert.equal(envelope.documents?.length, 1)
  assert.equal(envelope.documents?.[0].documentId, '1')
  assert.equal(envelope.documents?.[0].fileExtension, 'pdf')
  assert.equal(envelope.documents?.[0].transformPdfFields, 'false')
  assert.equal(envelope.documents?.[0].documentBase64, bytes.toString('base64'))
  assert.equal(envelope.emailSubject, 'Rental City lease for Harbor House')
  const signer = envelope.recipients?.signers?.[0]
  assert.equal(signer?.clientUserId, 'tenant-profile-id')
  assert.equal(signer?.requireIdLookup, 'false')
  assert.equal(signer?.tabs?.signHereTabs?.length, 1)
  assert.equal(signer?.tabs?.dateSignedTabs?.length, 1)
  assert.equal(signer?.tabs?.signHereTabs?.[0].pageNumber, '1')
  assert.equal(signer?.tabs?.radioGroupTabs?.length, 0)
  assert.equal(LEASE_VOID_REASON.includes('Equifax'), false)
})

test('non-lease envelopes do not force transformPdfFields', () => {
  const envelope = buildEmbeddedEnvelopeDefinition({
    documentBase64: Buffer.from('<p>Agreement</p>').toString('base64'),
    documentName: 'Agreement.html',
    fileExtension: 'html',
    emailSubject: 'Rental City — Plaid End Client Consent Agreement',
    signer: { name: 'Landlord', email: 'landlord@example.com', clientUserId: 'landlord-id' },
    tabs: [{ type: 'sign', anchorString: 'Signature:', xOffset: '10' }],
    returnUrl: 'https://app.example.com/docusign/return?type=plaid',
  })
  assert.equal(envelope.documents?.[0].transformPdfFields, undefined)
  assert.equal(envelope.documents?.[0].fileExtension, 'html')
})

test('lease send authorization and void rules', () => {
  assert.equal(landlordMaySendLease({
    callerOwnsProperty: true,
    applicationOnProperty: true,
    messageThreadWithLandlord: false,
    activeInvite: false,
  }), true)
  assert.equal(landlordMaySendLease({
    callerOwnsProperty: true,
    applicationOnProperty: false,
    messageThreadWithLandlord: true,
    activeInvite: false,
  }), true)
  assert.equal(landlordMaySendLease({
    callerOwnsProperty: true,
    applicationOnProperty: false,
    messageThreadWithLandlord: false,
    activeInvite: true,
  }), true)
  assert.equal(landlordMaySendLease({
    callerOwnsProperty: false,
    applicationOnProperty: true,
    messageThreadWithLandlord: true,
    activeInvite: true,
  }), false)
  assert.equal(landlordMaySendLease({
    callerOwnsProperty: true,
    applicationOnProperty: false,
    messageThreadWithLandlord: false,
    activeInvite: false,
  }), false)
  assert.equal(shouldVoidExistingLease('sent'), true)
  assert.equal(shouldVoidExistingLease('delivered'), true)
  assert.equal(shouldVoidExistingLease('completed'), false)
  assert.equal(shouldVoidExistingLease('declined'), false)
  assert.equal(shouldVoidExistingLease('voided'), false)
})

test('lease view hides storage paths and limits download', () => {
  const row: LeaseRow = {
    id: 'lease-1',
    landlord_id: 'landlord-1',
    tenant_id: 'tenant-1',
    property_id: 'property-1',
    application_id: null,
    original_storage_path: 'lease-1/original.pdf',
    signed_storage_path: 'lease-1/signed.pdf',
    envelope_id: 'env-1',
    envelope_status: 'completed',
    sent_at: '2026-11-03T00:00:00.000Z',
    completed_at: '2026-11-03T01:00:00.000Z',
    created_at: '2026-11-03T00:00:00.000Z',
    property_label: 'Harbor House',
  }
  const view = leasePublicView(row)
  const serialized = JSON.stringify(view)
  assert.equal(serialized.includes('original.pdf'), false)
  assert.equal(serialized.includes('signed.pdf'), false)
  assert.equal(serialized.includes('storage'), false)
  assert.equal(view.hasOriginal, true)
  assert.equal(view.hasSigned, true)
  assert.equal(view.statusLabel, 'Signed')
  assert.equal(callerMayDownloadLease(row, 'landlord-1'), true)
  assert.equal(callerMayDownloadLease(row, 'tenant-1'), true)
  assert.equal(callerMayDownloadLease(row, 'someone-else'), false)
  assert.equal(callerMayDownloadLease(row, ''), false)
})

test('lease completion decision and usage log do not create an envelope', () => {
  assert.equal(shouldStoreSignedPdf('completed'), true)
  assert.equal(shouldStoreSignedPdf('sent'), false)
  assert.equal(shouldStoreSignedPdf('delivered'), false)
  assert.equal(shouldStoreSignedPdf('declined'), false)
  const lines: string[] = []
  const original = console.info
  console.info = (message?: unknown) => {
    lines.push(String(message))
  }
  try {
    logLeaseEnvelopeCreated('lease-1', 'env-9', new Date('2026-11-03T12:00:00.000Z'))
  } finally {
    console.info = original
  }
  assert.equal(lines.length, 1)
  assert.match(lines[0], /lease_envelope_created leaseId=lease-1 envelopeId=env-9 at=2026-11-03T12:00:00.000Z/)
  const current = pickCurrentLease([
    { envelope_status: 'voided', created_at: '2026-11-03T03:00:00.000Z' },
    { envelope_status: 'completed', created_at: '2026-11-03T01:00:00.000Z' },
    { envelope_status: 'sent', created_at: '2026-11-03T02:00:00.000Z' },
  ])
  assert.equal(current?.envelope_status, 'sent')
})

test('lease return URL is type=lease', () => {
  const url = new URL(leaseReturnUrl('https://app.example.com', 'env-123'))
  assert.equal(url.origin, 'https://app.example.com')
  assert.equal(url.pathname, '/docusign/return')
  assert.equal(url.searchParams.get('type'), 'lease')
  assert.equal(url.searchParams.get('envelopeId'), 'env-123')
})

test('lease status labels match the landlord view', () => {
  assert.equal(leaseStatusLabel(null), 'Not sent')
  assert.equal(leaseStatusLabel('sent'), 'Sent')
  assert.equal(leaseStatusLabel('delivered'), 'Viewed')
  assert.equal(leaseStatusLabel('completed'), 'Signed')
  assert.equal(leaseStatusLabel('declined'), 'Declined')
  assert.equal(leaseStatusLabel('voided'), 'Voided')
})
