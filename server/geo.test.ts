import assert from 'node:assert/strict'
import test from 'node:test'
import { firstKnownLocation, haversineMiles } from './geo'

test('location priority uses complete valid pairs without mixing sources', () => {
  const fallback = { lat: 35, lng: -90 }
  assert.deepEqual(firstKnownLocation({ lat: 0, lng: 0 }, fallback), { lat: 0, lng: 0 })
  assert.deepEqual(firstKnownLocation({ lat: 40 }, fallback), fallback)
  assert.deepEqual(firstKnownLocation({ lat: 91, lng: 0 }, fallback), fallback)
  assert.equal(firstKnownLocation({ lat: 35 }, { lng: -90 }), null)
  assert.equal(firstKnownLocation(null, undefined), null)
})

test('distance remains precise at radius boundaries and finite at antipodes', () => {
  assert.equal(haversineMiles(35, -90, 35, -90), 0)
  const longitudeForMiles = (miles: number) => miles / 3958.8 * 180 / Math.PI
  const outside = haversineMiles(0, 0, 0, longitudeForMiles(50.2))
  assert.ok(outside > 50)
  assert.equal(Math.round(outside), 50, 'display rounding must not drive exclusion')
  assert.ok(Math.abs(haversineMiles(0, 0, 0, 180) - Math.PI * 3958.8) < 0.001)
})
