import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAddressString, geocodeAddress } from './geocode'

test('address formatting excludes empty optional parts', () => {
  assert.equal(buildAddressString({
    addressLine1: '123 Main St', addressLine2: ' ', city: 'Testville', state: 'CA', postalCode: null,
  }), '123 Main St, Testville, CA')
})

test('missing configuration and blank addresses do not call Google', async (t) => {
  let calls = 0
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw new Error('Unexpected request') })
  assert.equal((await geocodeAddress('123 Main St', undefined)).ok, false)
  assert.equal((await geocodeAddress(' ', 'test-key')).ok, false)
  assert.equal(calls, 0)
})

test('Google coordinates are returned on a successful response', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({
    status: 'OK', results: [{ geometry: { location: { lat: 37.42, lng: -122.08 } } }],
  }))
  assert.deepEqual(await geocodeAddress('123 Main St', 'test-key'), { ok: true, lat: 37.42, lng: -122.08 })
})

test('provider configuration errors and network failures remain explicit non-throwing failures', async (t) => {
  const request = t.mock.method(globalThis, 'fetch', async () => Response.json({
    status: 'REQUEST_DENIED', error_message: 'API not enabled',
  }))
  assert.deepEqual(await geocodeAddress('123 Main St', 'test-key'), {
    ok: false, status: 'REQUEST_DENIED', error_message: 'API not enabled',
  })
  request.mock.mockImplementation(async () => { throw new Error('Network unavailable') })
  assert.deepEqual(await geocodeAddress('123 Main St', 'test-key'), {
    ok: false, status: 'request_failed', error_message: 'Network unavailable',
  })
})
