import assert from 'node:assert/strict'
import test from 'node:test'
import { sendReportEmail } from './email'
import {
  TOUR_REQUEST_WINDOW_MS,
  decideTourRequest,
  formatListingAddress,
  submitListingTourRequest,
  type StoredTourRequest,
  type TourInsert,
  type TourListing,
  type TourStore,
} from './tourRequest'

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111'
const TENANT_ID = '22222222-2222-4222-8222-222222222222'
const LANDLORD_EMAIL = 'landlord@example.test'
const TENANT_EMAIL = 'tenant@example.test'
const APP_URL = 'https://app.gorentalcity.com'

const listing: TourListing = {
  id: PROPERTY_ID,
  landlordId: '33333333-3333-4333-8333-333333333333',
  status: 'active',
  addressLine1: '100 Test Avenue',
  addressLine2: null,
  city: 'Tampa',
  state: 'FL',
  postalCode: '33601',
}

function memoryStore(seed: StoredTourRequest[] = []): TourStore & { rows: Array<TourInsert & { id: string; createdAt: string }> } {
  const rows: Array<TourInsert & { id: string; createdAt: string }> = seed.map((row) => ({
    id: row.id,
    propertyId: row.propertyId,
    landlordId: listing.landlordId,
    tenantId: row.tenantId,
    tenantEmail: row.email,
    tenantName: 'Existing Tenant',
    tenantPhone: null,
    preferredTime: row.preferredTime,
    message: row.message,
    dedupeKey: `seed-${row.id}`,
    hourBucket: row.createdAt,
    slot: 1,
    createdAt: row.createdAt,
  }))
  return {
    rows,
    async getListing(propertyId) {
      return propertyId === listing.id ? listing : null
    },
    async landlordEmail() {
      return LANDLORD_EMAIL
    },
    async recentRequests(propertyId, sinceIso) {
      const since = Date.parse(sinceIso)
      return rows
        .filter((row) => row.propertyId === propertyId && Date.parse(row.createdAt) >= since)
        .map((row) => ({
          id: row.id,
          propertyId: row.propertyId,
          tenantId: row.tenantId,
          email: row.tenantEmail,
          message: row.message,
          preferredTime: row.preferredTime,
          createdAt: row.createdAt,
        }))
    },
    async insert(row) {
      if (rows.some((existing) => existing.propertyId === row.propertyId && existing.dedupeKey === row.dedupeKey)) {
        return { conflict: 'dedupe' as const }
      }
      if (
        rows.some(
          (existing) =>
            existing.propertyId === row.propertyId &&
            existing.tenantId === row.tenantId &&
            existing.hourBucket === row.hourBucket &&
            existing.slot === row.slot,
        )
      ) {
        return { conflict: 'slot' as const }
      }
      const id = `row-${rows.length + 1}`
      rows.push({ ...row, id, createdAt: new Date().toISOString() })
      return { id }
    },
    async remove(id) {
      const index = rows.findIndex((row) => row.id === id)
      if (index >= 0) rows.splice(index, 1)
    },
  }
}

const requestBody = {
  propertyId: PROPERTY_ID,
  name: 'Ada Tenant',
  email: TENANT_EMAIL,
  phone: '813-555-0100',
  preferredTime: '2026-11-24T15:00',
  message: 'Could I see the kitchen on Tuesday?',
}

test('tour request emails the listing landlord and confirms to the tenant', async () => {
  const previousKey = process.env.MAILERSEND_API_KEY
  const previousFrom = process.env.FROM_EMAIL
  process.env.MAILERSEND_API_KEY = 'test-key'
  process.env.FROM_EMAIL = 'noreply@example.test'
  const calls: Array<{ url: string; body: Record<string, unknown> }> = []
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) })
    return new Response('', { status: 202 })
  }) as typeof fetch

  try {
    const store = memoryStore()
    const result = await submitListingTourRequest(store, { id: TENANT_ID }, requestBody, sendReportEmail, APP_URL)
    assert.equal(result.status, 200)
    assert.deepEqual(result.body, { ok: true, confirmationSent: true })
    assert.equal(JSON.stringify(result).includes(LANDLORD_EMAIL), false)
    assert.equal(calls.length, 2)
    assert.ok(calls.every((call) => call.url === 'https://api.mailersend.com/v1/email'))

    const landlord = calls[0].body
    const confirmation = calls[1].body
    assert.deepEqual(landlord.to, [{ email: LANDLORD_EMAIL }])
    assert.deepEqual(landlord.reply_to, { email: TENANT_EMAIL, name: 'Ada Tenant' })
    assert.equal(String(landlord.html).includes(formatListingAddress(listing)), true)
    assert.equal(String(landlord.html).includes(`${APP_URL}/property/${PROPERTY_ID}`), true)
    assert.equal(String(landlord.html).includes('Could I see the kitchen on Tuesday?'), true)
    assert.equal(String(landlord.html).includes('813-555-0100'), true)
    assert.deepEqual(confirmation.to, [{ email: TENANT_EMAIL }])
    assert.equal(confirmation.reply_to, undefined)
    assert.equal(String(confirmation.html).includes(LANDLORD_EMAIL), false)
    assert.equal(calls.some((call) => JSON.stringify(call.body.to).includes('ssn')), false)
  } finally {
    globalThis.fetch = originalFetch
    if (previousKey === undefined) delete process.env.MAILERSEND_API_KEY
    else process.env.MAILERSEND_API_KEY = previousKey
    if (previousFrom === undefined) delete process.env.FROM_EMAIL
    else process.env.FROM_EMAIL = previousFrom
  }
})

test('duplicate and hourly tour requests do not send another email', async () => {
  const calls: string[] = []
  const send = async () => {
    calls.push('sent')
    return true
  }
  const now = Date.parse('2026-11-23T18:00:00.000Z')
  const store = memoryStore([
    {
      id: 'existing',
      propertyId: PROPERTY_ID,
      tenantId: TENANT_ID,
      email: TENANT_EMAIL,
      message: requestBody.message,
      preferredTime: requestBody.preferredTime,
      createdAt: new Date(now - 30_000).toISOString(),
    },
  ])
  const duplicate = await submitListingTourRequest(store, { id: TENANT_ID }, requestBody, send, APP_URL, now)
  assert.equal(duplicate.status, 409)
  assert.equal(calls.length, 0)

  const older = Array.from({ length: 3 }, (_, index) => ({
    id: `old-${index}`,
    propertyId: PROPERTY_ID,
    tenantId: TENANT_ID,
    email: TENANT_EMAIL,
    message: `Earlier note ${index}`,
    preferredTime: null,
    createdAt: new Date(now - (index + 1) * 60_000).toISOString(),
  }))
  const limited = await submitListingTourRequest(
    memoryStore(older),
    { id: TENANT_ID },
    { ...requestBody, message: 'A different question about parking.' },
    send,
    APP_URL,
    now,
  )
  assert.equal(limited.status, 429)
  assert.equal(calls.length, 0)
  assert.equal(decideTourRequest(older, { tenantId: TENANT_ID, email: TENANT_EMAIL, message: 'new', preferredTime: null }, now), 'rate_limited')
  assert.ok(TOUR_REQUEST_WINDOW_MS === 60 * 60 * 1000)
})

test('a failed provider send does not keep the tour request', async () => {
  const store = memoryStore()
  const result = await submitListingTourRequest(store, { id: TENANT_ID }, requestBody, async () => false, APP_URL)
  assert.equal(result.status, 502)
  assert.equal(store.rows.length, 0)
  assert.equal(JSON.stringify(result).includes(LANDLORD_EMAIL), false)
})

test('tour request validation rejects a missing message', async () => {
  const store = memoryStore()
  const result = await submitListingTourRequest(
    store,
    { id: TENANT_ID },
    { ...requestBody, message: '   ' },
    async () => {
      throw new Error('email provider should not be called')
    },
    APP_URL,
  )
  assert.equal(result.status, 400)
  assert.equal(store.rows.length, 0)
})
