import assert from 'node:assert/strict'
import test from 'node:test'
import { computeMatch, landlordAnswersToPrefs, tenantAnswersToHistory } from './match'

const dimensions = { affordability: 7, stability: 7, paymentRisk: 7, lifestyle: 7 }

test('voucher tenants are excluded only when the landlord explicitly declines vouchers', () => {
  const tenant = tenantAnswersToHistory({ participates_in_voucher_program: 'yes' })
  for (const answer of ['no', false] as const) {
    const result = computeMatch(dimensions, landlordAnswersToPrefs({ accepts_housing_vouchers: answer }), tenant)
    assert.equal(result.eligible, false)
    assert.equal(result.overall, 0)
    assert.ok(result.reasons.includes('Landlord does not accept housing vouchers.'))
  }
  for (const answer of ['yes', true, null, undefined] as const) {
    const result = computeMatch(dimensions, landlordAnswersToPrefs({ accepts_housing_vouchers: answer }), tenant)
    assert.equal(result.eligible, true)
    assert.ok(result.overall > 0)
  }
})

test('non-voucher tenants keep identical scores regardless of voucher acceptance', () => {
  for (const answer of ['no', false, undefined] as const) {
    const tenant = tenantAnswersToHistory({ participates_in_voucher_program: answer })
    const baseline = computeMatch(dimensions, landlordAnswersToPrefs({}), tenant)
    for (const accepts of ['yes', 'no', true, false, null] as const) {
      assert.deepEqual(
        computeMatch(dimensions, landlordAnswersToPrefs({ accepts_housing_vouchers: accepts }), tenant),
        baseline,
      )
    }
  }
})

test('voucher participation does not change scoring when the landlord accepts vouchers', () => {
  const landlord = landlordAnswersToPrefs({ accepts_housing_vouchers: true })
  const yes = tenantAnswersToHistory({ participates_in_voucher_program: true })
  const no = tenantAnswersToHistory({ participates_in_voucher_program: false })
  assert.deepEqual(computeMatch(dimensions, landlord, yes), computeMatch(dimensions, landlord, no))
})
