import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deriveListingPins } from './listingMapPins'
import { matchScoreHex, scoreBarColor } from './matchScoreColor'

test('pins are created only for listings with coordinates and use existing match-score colors', () => {
  const listings = [
    { id: 'with-high', lat: 35.15, lng: -90.05, matchScore: 91, priceLabel: '$2,400' },
    { id: 'with-mid', lat: '35.2', lng: '-89.9', matchScore: 60, priceLabel: '$1,800' },
    { id: 'no-coords', lat: null, lng: null, matchScore: 88, priceLabel: '$2,000' },
    { id: 'lat-only', lat: 35.1, lng: null, matchScore: 40, priceLabel: '$1,500' },
    { id: 'invalid', lat: 120, lng: -90, matchScore: 10, priceLabel: '$900' },
    { id: 'low', lat: 35.05, lng: -90.1, matchScore: 12, priceLabel: '$1,100' },
    { id: 'score-missing', lat: 35.3, lng: -90.2, priceLabel: '$1,250' },
  ]

  const pins = deriveListingPins(listings)
  assert.deepEqual(pins.map((pin) => pin.id), ['with-high', 'with-mid', 'low', 'score-missing'])
  assert.equal(pins[0]?.color, '#3A7AFE')
  assert.equal(pins[0]?.color, matchScoreHex(91))
  assert.equal(scoreBarColor(91).bg, 'bg-[#3A7AFE]')
  assert.equal(pins[1]?.color, matchScoreHex(60))
  assert.equal(pins[1]?.color, '#5C8AFF')
  assert.equal(pins[2]?.color, '#BAD1FF')
  assert.equal(pins[3]?.scoreKnown, false)
  assert.equal(pins[3]?.color, '#BAD1FF')
  assert.equal(pins[0]?.scoreKnown, true)
  assert.equal(pins[0]?.lat, 35.15)
  assert.equal(pins[1]?.lng, -89.9)
})

test('match-score color bands stay on the existing thresholds', () => {
  assert.equal(matchScoreHex(0), '#BAD1FF')
  assert.equal(matchScoreHex(25), '#BAD1FF')
  assert.equal(matchScoreHex(26), '#85AAFF')
  assert.equal(matchScoreHex(50), '#85AAFF')
  assert.equal(matchScoreHex(51), '#5C8AFF')
  assert.equal(matchScoreHex(75), '#5C8AFF')
  assert.equal(matchScoreHex(76), '#3A7AFE')
  assert.equal(matchScoreHex(100), '#3A7AFE')
  for (const score of [0, 25, 26, 50, 51, 75, 76, 100]) {
    assert.equal(scoreBarColor(score).bg, `bg-[${matchScoreHex(score)}]`)
    assert.equal(scoreBarColor(score).border, `border-[${matchScoreHex(score)}]`)
  }
})
