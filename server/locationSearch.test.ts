import assert from 'node:assert/strict'
import test from 'node:test'
import { searchLocation } from './locationSearch'
import { haversineMiles } from './geo'

test('city and ZIP searches work offline without any Google or RentCast request', (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('No network is allowed') })
  for (const query of ['Memphis, TN', 'memphis tn', 'Memphis, Tennessee', '38103', '38103-1234', 'Austin, TX', '78704', 'New York, NY', 'Los Angeles, CA']) {
    const result = searchLocation(query)
    assert.equal(result.ok, true, query)
    if (result.ok) {
      assert.equal(result.approximate, true)
      assert.ok(Number.isFinite(result.lat) && Number.isFinite(result.lng))
    }
  }
  const memphis = searchLocation('Memphis, TN')
  const zip = searchLocation('38103')
  if (memphis.ok && zip.ok) assert.ok(haversineMiles(memphis.lat, memphis.lng, zip.lat, zip.lng) < 20)
})

test('ambiguous and invalid locations are explicit failures, never arbitrary properties', () => {
  const ambiguous = searchLocation('Springfield')
  assert.equal(ambiguous.ok, false)
  if (!ambiguous.ok) assert.equal(ambiguous.status, 'ambiguous')
  for (const query of ['', '99999', 'Not a City, TN', 'Memphis, ZZ', '123 Main St', 'a'.repeat(121)]) {
    assert.equal(searchLocation(query).ok, false, query)
  }
})

test('leading zero ZIPs, full state names and multiword cities are supported', () => {
  for (const query of ['02108', 'Beverly Hills California', 'San Antonio TX', 'New York New York', 'Springfield, IL']) {
    assert.equal(searchLocation(query).ok, true, query)
  }
})
