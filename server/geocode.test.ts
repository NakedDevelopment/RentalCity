import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAddressString, geocodeAddress, isSameProperty, lookupPropertyLocation } from './geocode'

const address = { addressLine1: '5500 Grand Lake Drive', city: 'San Antonio', state: 'TX', postalCode: '78244' }
const record = { addressLine1: '5500 Grand Lake Dr', city: 'San Antonio', state: 'TX', zipCode: '78244',
  latitude: 29.475962, longitude: -98.351442 }

test('address formatting excludes empty optional parts', () => {
  assert.equal(buildAddressString({ addressLine1: ' 123 Main St ', addressLine2: ' ', city: 'Testville', state: 'CA' }),
    '123 Main St, Testville, CA')
})

test('missing configuration and incomplete addresses make no paid requests', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Unexpected request') })
  for (const result of [
    await geocodeAddress(address, undefined),
    await geocodeAddress({ city: 'Memphis', state: 'TN' }, 'test-key'),
    await geocodeAddress({ addressLine1: ' ' }, 'test-key'),
    await geocodeAddress({ addressLine1: '123 Main St', city: 'Memphis' }, 'test-key'),
  ]) assert.equal(result.ok, false)
  assert.equal(calls, 0)
})

test('RentCast exact property coordinates are returned, with server-side header auth', async (t) => {
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request, options?: RequestInit) => {
    assert.match(String(url), /^https:\/\/api\.rentcast\.io\/v1\/properties\?/)
    assert.doesNotMatch(String(url), /google|test-key/)
    assert.equal(new URL(String(url)).searchParams.get('address'), '5500 Grand Lake Drive, San Antonio, TX, 78244')
    assert.equal((options?.headers as Record<string, string>)['X-Api-Key'], 'test-key')
    return Response.json([record])
  })
  assert.deepEqual(await geocodeAddress(address, 'test-key'), { ok: true, lat: record.latitude, lng: record.longitude })
})

test('nearby properties, wrong states/ZIPs/units, and invalid coordinates are rejected', async (t) => {
  assert.equal(isSameProperty(address, { ...record, addressLine1: '5501 Grand Lake Dr' }), false)
  assert.equal(isSameProperty(address, { ...record, state: 'TN' }), false)
  assert.equal(isSameProperty(address, { ...record, zipCode: '78245' }), false)
  assert.equal(isSameProperty({ ...address, addressLine2: 'Unit 2' }, { ...record, addressLine2: 'Unit 3' }), false)
  assert.equal(isSameProperty({ ...address, addressLine2: 'Unit 2' }, record), true)
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...record, latitude: 999 }]))
  assert.equal((await geocodeAddress(address, 'test-key')).ok, false)
  request.mock.mockImplementation(async () => Response.json([{ ...record, addressLine1: '5501 Grand Lake Dr' }]))
  assert.equal((await geocodeAddress(address, 'test-key')).ok, false)
})

test('provider, malformed response, and network errors are explicit and redact details', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({ error: 'private upstream detail' }, { status: 429 }))
  assert.deepEqual(await geocodeAddress(address, 'test-key'), {
    ok: false, status: 'provider_429', error_message: 'Location lookup limit reached. Please try again later.',
  })
  request.mock.mockImplementation(async () => Response.json({ results: [record] }))
  assert.deepEqual(await geocodeAddress(address, 'test-key'), { ok: false, status: 'invalid_response' })
  request.mock.mockImplementation(async () => { throw new Error('private URL and key') })
  const result = await geocodeAddress(address, 'test-key')
  assert.equal(result.ok, false)
  assert.doesNotMatch(JSON.stringify(result), /private/)
})

test('missing records are negative-cached rather than repeatedly billed or approximated', async (t) => {
  let calls = 0
  const missing = { ...address, addressLine1: '99999 Missing St' }
  t.mock.method(globalThis, 'fetch', async () => { calls++; return new Response(null, { status: 404 }) })
  const result = await lookupPropertyLocation(missing, 'test-key')
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.status, 'no_exact_match')
  await lookupPropertyLocation(missing, 'test-key')
  assert.equal(calls, 1)
})

test('repeated and concurrent lookups share a paid request; edited addresses do not reuse it', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; return Response.json([record]) })
  const results = await Promise.all([lookupPropertyLocation(address, 'test-key'), lookupPropertyLocation(address, 'test-key')])
  assert.equal(results.every((result) => result.ok), true)
  await lookupPropertyLocation(address, 'test-key')
  assert.equal(calls, 1)
  assert.equal((await lookupPropertyLocation({ ...address, addressLine1: '123 Changed St' }, 'test-key')).ok, false)
  assert.equal(calls, 2)
})

test('lookup strips inline apartment formatting but preserves the original match requirements', async (t) => {
  const input = { addressLine1: '998 Fair St #1 SW', city: 'Atlanta', state: 'GA', postalCode: '30314' }
  t.mock.method(globalThis, 'fetch', async (url: string | URL | Request) => {
    assert.equal(new URL(String(url)).searchParams.get('address'), '998 Fair St SW, Atlanta, GA, 30314')
    return Response.json([{ addressLine1: '998 Fair St SW', addressLine2: 'Apt 1',
      city: 'Atlanta', state: 'GA', zipCode: '30314', latitude: 33.7, longitude: -84.4 }])
  })
  assert.deepEqual(await geocodeAddress(input, 'test-key'), { ok: true, lat: 33.7, lng: -84.4 })
  assert.equal(input.addressLine1, '998 Fair St #1 SW')
})

test('ZIP conflicts are returned as review candidates, never silently corrected', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json([{ ...record, zipCode: '78245' }]))
  const result = await geocodeAddress(address, 'test-key')
  assert.equal(result.ok, false)
  if (!result.ok) {
    assert.equal(result.status, 'review_required')
    assert.equal(result.candidates?.[0].reason, 'zip_conflict')
    assert.equal(result.candidates?.[0].zip, '78245')
  }
})

test('ambiguous street-type completions are flagged even if they share a coordinate', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json([
    { ...record, addressLine1: '5500 Grand Lake Dr' },
    { ...record, addressLine1: '5500 Grand Lake Rd' },
  ]))
  const incomplete = { ...address, addressLine1: '5500 Grand Lake' }
  const result = await geocodeAddress(incomplete, 'test-key')
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.candidates?.[0].reason, 'ambiguous_match')
  request.mock.mockImplementation(async () => Response.json([
    record, { ...record, longitude: record.longitude + 0.02 },
  ]))
  assert.equal((await geocodeAddress(address, 'test-key')).ok, false)
})
