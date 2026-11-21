import assert from 'node:assert/strict'
import test from 'node:test'
import {
  affordabilityFromStatedIncome,
  matchAffordabilityFromStatedIncome,
  rentScoreFromQuestionnaireRow,
  scoreRentToIncome,
} from './rentScore'

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
