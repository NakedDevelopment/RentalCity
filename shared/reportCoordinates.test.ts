import assert from 'node:assert/strict'
import test from 'node:test'
import { coordinatesForReportAddress, rentCastCoordinates, validCoordinates } from './reportCoordinates'
import { buildReport } from '../server/report-template'

test('coordinate pairs support zero and URL strings, but reject missing or invalid values', () => {
  assert.deepEqual(validCoordinates('0', '-90.5'), { lat: 0, lng: -90.5 })
  for (const [lat, lng] of [[null, null], ['', ''], [undefined, 1], [true, 1],
    [91, 0], [0, -181], [NaN, 1], [1, Infinity], ['bad', '1']]) {
    assert.equal(validCoordinates(lat, lng), null)
  }
})

test('RentCast uses subject coordinates first and property record as fallback', () => {
  const subject = { latitude: 35.1, longitude: -90.1 }
  const property = { latitude: 36, longitude: -91 }
  assert.deepEqual(rentCastCoordinates(subject, property), { lat: 35.1, lng: -90.1 })
  assert.deepEqual(rentCastCoordinates({ latitude: 35 }, property), { lat: 36, lng: -91 })
  assert.equal(rentCastCoordinates({ comparables: [subject] }), null)
})

test('report coordinates are usable only for the unchanged report address', () => {
  const address = { streetAddress: '123 Main St', city: 'Memphis', state: 'TN', zipCode: '38103' }
  const report = { ...address, lat: 35.1, lng: -90.1 }
  assert.deepEqual(coordinatesForReportAddress(report, address), { lat: 35.1, lng: -90.1 })
  assert.deepEqual(coordinatesForReportAddress(report, { ...address, city: ' MEMPHIS ' }), { lat: 35.1, lng: -90.1 })
  for (const field of ['streetAddress', 'city', 'state', 'zipCode'] as const) {
    assert.equal(coordinatesForReportAddress(report, { ...address, [field]: 'changed' }), null)
  }
  assert.equal(coordinatesForReportAddress(address, address), null)
})

test('full report and email listing links preserve coordinates, including zero', () => {
  const report = buildReport(
    { address: '123 Main St, Memphis, TN 38103', lat: 0, lng: -90.1 },
    { rent: 1500, confidence: 90 },
  )
  for (const html of [report.reportHtml, report.emailHtml]) {
    const href = html.match(/href="([^"]*\/list-from-report\?[^"]*)"/)?.[1]
    assert.ok(href)
    const url = new URL(href.replaceAll('&amp;', '&'))
    assert.equal(url.searchParams.get('lat'), '0')
    assert.equal(url.searchParams.get('lng'), '-90.1')
  }
  const legacy = buildReport({ address: '123 Main St' }, { rent: 1500, confidence: 90 })
  assert.doesNotMatch(legacy.reportHtml, /[?&](?:amp;)?lat=/)
})
