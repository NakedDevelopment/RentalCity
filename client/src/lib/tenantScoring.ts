import { affordabilityFromStatedIncome } from '../../../shared/rentScore'
import { tenantQuestions, type TenantQuestionId, type TenantChoiceId } from './tenantQuestionnaire'

export { scoreRentToIncome } from '../../../shared/rentScore'

export type TenantAnswers = Record<TenantQuestionId, TenantChoiceId | null | undefined>

export type TenantScoreResult = {
  rawScore: number
  maxScore: number
  normalizedScore: number // 0–1
  percentage: number // 0–100
}

export type TenantDimensionScores = {
  stability: number // 0–10
  paymentRisk: number // 0–10 (higher is safer)
  affordability: number // 0–10
  lifestyle: number // 0–10
  spaceFit: number // 0–10
  overall: number // 0–100
}

function getHouseholdSizeFromAnswer(choiceId: TenantChoiceId | null | undefined): number | null {
  switch (choiceId) {
    case 'a':
      return 2
    case 'b':
      return 3
    case 'c':
      return 4
    case 'd':
      return 5
    default:
      return null
  }
}

function getBedroomsFromAnswer(choiceId: TenantChoiceId | null | undefined): number | null {
  switch (choiceId) {
    case 'a':
      return 1
    case 'b':
      return 2
    case 'c':
      return 3
    case 'd':
      return 4 // 4 or more
    default:
      return null
  }
}

export function scoreOccupancy(householdChoice: TenantChoiceId | null | undefined, bedroomChoice: TenantChoiceId | null | undefined): number {
  const familySize = getHouseholdSizeFromAnswer(householdChoice)
  const bedrooms = getBedroomsFromAnswer(bedroomChoice)
  if (familySize == null || bedrooms == null) return 0

  const diff = familySize - bedrooms

  if (diff <= 0) return 10
  if (diff === 1) return 9
  if (diff === 2) return 8
  if (diff === 3) return 6
  return 4
}

function scoreFromChoice(questionId: TenantQuestionId, answers: TenantAnswers): number | null {
  const answer = answers[questionId]
  if (!answer) return null
  const question = tenantQuestions.find((q) => q.id === questionId)
  if (!question) return null
  const choice = question.choices.find((c) => c.id === answer)
  return choice ? choice.score : null
}

// Higher is safer / better in all dimensions
export function scoreTenantDimensions(
  answers: TenantAnswers,
  rent: number,
  monthlyIncome: number,
): TenantDimensionScores {
  const rentScore = affordabilityFromStatedIncome({
    rent,
    statedMonthlyIncome: monthlyIncome > 0 ? monthlyIncome : null,
    incomeVerified: false,
  })
  const occupancyScore = scoreOccupancy(answers['household_size'] ?? null, answers['bedrooms_needed'] ?? null)

  // Stability: previous landlord + employment duration
  const stabilityComponents = [
    scoreFromChoice('previous_landlord_duration', answers),
    scoreFromChoice('employment_duration', answers),
  ].filter((v): v is number => v != null)
  const stability =
    stabilityComponents.length > 0
      ? stabilityComponents.reduce((sum, v) => sum + v, 0) / stabilityComponents.length
      : 0

  // Payment risk: late fees, emergency funds handling, eviction history, late frequency, bankruptcy
  const paymentComponents = [
    scoreFromChoice('late_fees_last_two_years', answers),
    scoreFromChoice('emergency_funds', answers),
    scoreFromChoice('eviction_history', answers),
    scoreFromChoice('late_frequency_reported', answers),
    scoreFromChoice('bankruptcy_history', answers),
  ].filter((v): v is number => v != null)
  const paymentRisk =
    paymentComponents.length > 0
      ? paymentComponents.reduce((sum, v) => sum + v, 0) / paymentComponents.length
      : 0

  // Lifestyle / cooperation: 24‑hour notice, rental insurance, conflict reaction
  const lifestyleComponents = [
    scoreFromChoice('twenty_four_hour_notice', answers),
    scoreFromChoice('rental_insurance_acceptance', answers),
    scoreFromChoice('conflict_reaction', answers),
  ].filter((v): v is number => v != null)
  const lifestyle =
    lifestyleComponents.length > 0
      ? lifestyleComponents.reduce((sum, v) => sum + v, 0) / lifestyleComponents.length
      : 0

  const affordability = rentScore
  const spaceFit = occupancyScore

  // Overall (0–100) using suggested weights
  const overall0to1 =
    0.35 * (affordability / 10) +
    0.25 * (stability / 10) +
    0.25 * (paymentRisk / 10) +
    0.1 * (lifestyle / 10) +
    0.05 * (spaceFit / 10)

  const overall = Math.round(overall0to1 * 100)

  return {
    stability,
    paymentRisk,
    affordability,
    lifestyle,
    spaceFit,
    overall,
  }
}

export function scoreTenant(answers: TenantAnswers, rentScore: number, occupancyScoreOverride?: number): TenantScoreResult {
  let rawScore = 0
  let answeredCount = 0

  for (const question of tenantQuestions) {
    const answer = answers[question.id]

    // Q5+Q6 occupancy: we handle via override / dedicated function
    if (question.id === 'household_size' || question.id === 'bedrooms_needed') {
      continue
    }

    if (!answer) continue

    const choice = question.choices.find((c) => c.id === answer)
    if (!choice) continue

    rawScore += choice.score
    answeredCount += 1
  }

  // Add occupancy (Q5+Q6) if provided
  const occupancyScore =
    occupancyScoreOverride ??
    scoreOccupancy(answers['household_size'] ?? null, answers['bedrooms_needed'] ?? null)

  if (occupancyScore > 0) {
    rawScore += occupancyScore
    answeredCount += 1
  }

  // Add rent‑to‑income (Q7) score
  if (rentScore >= 0) {
    rawScore += rentScore
    answeredCount += 1
  }

  if (answeredCount === 0) {
    return { rawScore: 0, maxScore: 0, normalizedScore: 0, percentage: 0 }
  }

  const maxScorePerQuestion = 10
  const maxScore = answeredCount * maxScorePerQuestion
  const normalizedScore = rawScore / maxScore

  return {
    rawScore,
    maxScore,
    normalizedScore,
    percentage: Math.round(normalizedScore * 100),
  }
}

