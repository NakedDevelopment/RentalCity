import assert from 'node:assert/strict'
import test from 'node:test'
import {
  affordabilityFromStatedIncome,
  landlordCatalogRentScore,
  landlordTenantProfileRentScore,
  matchAffordabilityFromStatedIncome,
  matchesForLandlordRentScore,
  matchesForTenantRentScore,
  rentScoreFromQuestionnaireRow,
  scoreRentToIncome,
  tenantYourMatchesRentScore,
  type QuestionnaireRentScoreRow,
} from './rentScore'

/** tenantDisplayScoreFromQuestionnaire at parent 139f07c, before PR #2. */
function rentScoreBeforePr2(t: QuestionnaireRentScoreRow): number | null {
  if (t.overall_score != null && Number.isFinite(Number(t.overall_score))) {
    return Math.round(Number(t.overall_score))
  }
  const a = Number(t.affordability_score)
  const s = Number(t.stability_score)
  const p = Number(t.payment_risk_score)
  const l = Number(t.lifestyle_score)
  const vals = [a, s, p, l].map((v) => (Number.isFinite(v) ? v : null))
  if (vals.some((v) => v != null)) {
    const nums = vals.map((v) => (v != null ? v : 5))
    return Math.round(((nums[0] + nums[1] + nums[2] + nums[3]) / 4) * 10)
  }
  return null
}

const otherDimensions = {
  affordability_score: 0,
  stability_score: 10,
  payment_risk_score: 9,
  lifestyle_score: 10,
  space_fit_score: 8,
}

test('verified and unverified stated income produce the same affordability', () => {
  const cases = [
    { rent: 1850, income: 8000 },
    { rent: 1850, income: 5500 },
    { rent: 1850, income: 4700 },
    { rent: 2750, income: 5000 },
    { rent: 0, income: 8000 },
  ]
  for (const { rent, income } of cases) {
    const verified = affordabilityFromStatedIncome({
      rent,
      statedMonthlyIncome: income,
      incomeVerified: true,
    })
    const unverified = affordabilityFromStatedIncome({
      rent,
      statedMonthlyIncome: income,
      incomeVerified: false,
    })
    assert.equal(verified, unverified)
    assert.equal(verified, scoreRentToIncome(rent, income))
  }
})

test('unverified stated income is counted and does not lower the rent score', () => {
  const answers = { monthly_income: 8000, rental_budget: 'd' }
  const verified = rentScoreFromQuestionnaireRow({ ...otherDimensions, answers }, true)
  const unverified = rentScoreFromQuestionnaireRow({ ...otherDimensions, answers }, false)
  assert.equal(unverified.dimensions.affordability, verified.dimensions.affordability)
  assert.equal(unverified.dimensions.affordability, 10)
  assert.equal(unverified.score, verified.score)
  assert.equal(unverified.dimensions.stability, verified.dimensions.stability)
  assert.equal(unverified.dimensions.risk, verified.dimensions.risk)
  assert.equal(unverified.dimensions.lifestyle, verified.dimensions.lifestyle)
  assert.equal(unverified.dimensions.policy, verified.dimensions.policy)
  const withoutIncome = rentScoreFromQuestionnaireRow(
    { ...otherDimensions, answers: { rental_budget: 'd' } },
    false,
  )
  assert.ok(unverified.score > withoutIncome.score)
})

test('numeric text income counts the same as a number, verified or not', () => {
  const fromNumber = rentScoreFromQuestionnaireRow(
    { ...otherDimensions, answers: { monthly_income: 8000, rental_budget: 'd' } },
    true,
  )
  const fromText = rentScoreFromQuestionnaireRow(
    { ...otherDimensions, answers: { monthly_income: '$8,000', rental_budget: 'd' } },
    false,
  )
  assert.deepEqual(fromText, fromNumber)
})

test('missing stated income keeps the stored affordability for either verification flag', () => {
  const row = { ...otherDimensions, affordability_score: 7, answers: { rental_budget: 'd' } }
  const verified = rentScoreFromQuestionnaireRow(row, true)
  const unverified = rentScoreFromQuestionnaireRow(row, false)
  assert.equal(verified.dimensions.affordability, 7)
  assert.deepEqual(unverified, verified)
})

test('listing match affordability uses stated income whether or not it is verified', () => {
  const verified = matchAffordabilityFromStatedIncome({
    rent: 1800,
    statedMonthlyIncome: 7000,
    storedAffordability: 0,
    incomeVerified: true,
  })
  const unverified = matchAffordabilityFromStatedIncome({
    rent: 1800,
    statedMonthlyIncome: '7000',
    storedAffordability: 0,
    incomeVerified: false,
  })
  assert.equal(verified, 10)
  assert.equal(unverified, verified)
})

test('non-income inputs and overall_score match the pre-PR #2 rent score', () => {
  const rows: QuestionnaireRentScoreRow[] = [
    {
      overall_score: 61,
      affordability_score: 2,
      stability_score: 8,
      payment_risk_score: 7,
      lifestyle_score: 6,
      space_fit_score: 0,
    },
    {
      overall_score: 61,
      affordability_score: 2,
      stability_score: 8,
      payment_risk_score: 7,
      lifestyle_score: 6,
      space_fit_score: 10,
    },
    {
      overall_score: 80.4,
      affordability_score: null,
      stability_score: null,
      payment_risk_score: null,
      lifestyle_score: null,
      space_fit_score: 10,
    },
    { overall_score: 0, affordability_score: 10, stability_score: 10, payment_risk_score: 10, lifestyle_score: 10, space_fit_score: 10 },
    {
      overall_score: null,
      affordability_score: 8,
      stability_score: 6,
      payment_risk_score: 4,
      lifestyle_score: 2,
      space_fit_score: 0,
    },
    {
      overall_score: null,
      affordability_score: 8,
      stability_score: 6,
      payment_risk_score: 4,
      lifestyle_score: 2,
      space_fit_score: 10,
    },
    {
      overall_score: null,
      affordability_score: null,
      stability_score: 8,
      payment_risk_score: null,
      lifestyle_score: null,
      space_fit_score: 9,
    },
    {},
  ]
  for (const row of rows) {
    const expected = rentScoreBeforePr2(row)
    assert.equal(rentScoreFromQuestionnaireRow(row, false).score, expected)
    assert.equal(rentScoreFromQuestionnaireRow(row, true).score, expected)
    assert.equal(rentScoreFromQuestionnaireRow({ ...row, space_fit_score: 0 }, false).score, expected)
    assert.equal(rentScoreFromQuestionnaireRow({ ...row, space_fit_score: 10 }, true).score, expected)
  }
})

test('stated income replaces only affordability, and a stored overall_score still wins', () => {
  const base: QuestionnaireRentScoreRow = {
    overall_score: null,
    affordability_score: 0,
    stability_score: 10,
    payment_risk_score: 9,
    lifestyle_score: 10,
    space_fit_score: 1,
  }
  const answers = { monthly_income: 8000, rental_budget: 'd' }
  const verified = rentScoreFromQuestionnaireRow({ ...base, answers }, true)
  const unverified = rentScoreFromQuestionnaireRow({ ...base, answers }, false)
  assert.equal(verified.score, unverified.score)
  assert.equal(verified.dimensions.affordability, 10)
  assert.equal(unverified.score, rentScoreBeforePr2({ ...base, affordability_score: 10 }))
  assert.notEqual(unverified.score, rentScoreBeforePr2(base))
  assert.equal(
    rentScoreFromQuestionnaireRow({ ...base, answers, space_fit_score: 10 }, false).score,
    unverified.score,
  )
  assert.equal(
    rentScoreFromQuestionnaireRow({ ...base, answers, stability_score: 0 }, false).score,
    rentScoreBeforePr2({ ...base, affordability_score: 10, stability_score: 0 }),
  )

  const withOverall: QuestionnaireRentScoreRow = { ...base, overall_score: 64, answers }
  assert.equal(rentScoreFromQuestionnaireRow(withOverall, false).score, 64)
  assert.equal(rentScoreFromQuestionnaireRow(withOverall, true).score, 64)
  assert.equal(rentScoreFromQuestionnaireRow({ ...withOverall, space_fit_score: 10 }, false).score, 64)
})

test('every tenant and landlord rent-score surface returns the same score', () => {
  const surfaces = [
    tenantYourMatchesRentScore,
    landlordTenantProfileRentScore,
    landlordCatalogRentScore,
    matchesForLandlordRentScore,
    matchesForTenantRentScore,
  ]
  const rows: QuestionnaireRentScoreRow[] = [
    {
      overall_score: 61,
      affordability_score: 2,
      stability_score: 8,
      payment_risk_score: 7,
      lifestyle_score: 6,
      space_fit_score: 9,
      answers: { monthly_income: 8000, rental_budget: 'd' },
    },
    {
      overall_score: null,
      affordability_score: 0,
      stability_score: 10,
      payment_risk_score: 9,
      lifestyle_score: 10,
      space_fit_score: 8,
      answers: { monthly_income: '$8,000', rental_budget: 'd' },
    },
    {
      overall_score: null,
      affordability_score: 7,
      stability_score: 4,
      payment_risk_score: 3,
      lifestyle_score: 6,
      space_fit_score: 1,
    },
  ]
  for (const row of rows) {
    for (const incomeVerified of [true, false]) {
      const scores = surfaces.map((surface) => surface(row, incomeVerified).score)
      assert.equal(new Set(scores).size, 1)
      assert.equal(scores[0], rentScoreFromQuestionnaireRow(row, incomeVerified).score)
      assert.equal(scores[0], rentScoreFromQuestionnaireRow(row, !incomeVerified).score)
    }
  }
})
