/**
 * Rent-score affordability.
 *
 * The affordability component uses the tenant's stated monthly income and the
 * same rent-to-income bands as before. Income verification is not an input:
 * an unverified amount counts the same as a verified one, and it never lowers
 * the component. The "Unverified" badge is a separate display flag.
 */

/** Rent vs income: ≤30% = 10, ≤35% = 7, ≤40% = 5, else 0. Same units (dollars). */
export function scoreRentToIncome(rent: number, monthlyIncome: number): number {
  if (!rent || !monthlyIncome || monthlyIncome <= 0) return 0
  const ratio = rent / monthlyIncome
  if (ratio <= 0.3) return 10
  if (ratio <= 0.35) return 7
  if (ratio <= 0.4) return 5
  return 0
}

/** Midpoints of the tenant questionnaire rental-budget choices, in dollars. */
export const RENTAL_BUDGET_MONTHLY_RENT: Record<string, number> = {
  a: 1200,
  b: 1325,
  c: 1575,
  d: 1850,
  e: 2250,
  f: 2750,
}

export function rentalBudgetMonthlyRent(choice: unknown): number {
  if (typeof choice !== 'string') return 0
  return RENTAL_BUDGET_MONTHLY_RENT[choice] ?? 0
}

/** Positive stated monthly income from a questionnaire answer (number or numeric text). */
export function parseStatedMonthlyIncome(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/[^0-9.]/g, ''))
    if (Number.isFinite(parsed) && parsed > 0) return parsed
  }
  return null
}

export function affordabilityFromStatedIncome(input: {
  rent: number
  statedMonthlyIncome: number | null
  incomeVerified: boolean
}): number {
  // Both flags use the stated amount. Verification must not swap in 0.
  const stated = input.incomeVerified ? input.statedMonthlyIncome : input.statedMonthlyIncome
  if (stated == null) return scoreRentToIncome(input.rent, 0)
  return scoreRentToIncome(input.rent, stated)
}

export type RentScoreDimensions = {
  affordability: number
  stability: number
  risk: number
  lifestyle: number
  policy: number
}

/** DB columns may be 0–10 or legacy 0–100. */
export function normalizeRentScoreDimension(v: unknown): number {
  const raw = Number(v) || 0
  const normalized = raw > 10 ? raw / 10 : raw
  return Math.max(0, Math.min(10, normalized))
}

/** 0–100 rent score. Weights: affordability 35, stability 25, risk 25, lifestyle 10, space fit 5. */
export function computeRentScore(dimensions: RentScoreDimensions): number {
  const overall0to1 =
    0.35 * (dimensions.affordability / 10) +
    0.25 * (dimensions.stability / 10) +
    0.25 * (dimensions.risk / 10) +
    0.1 * (dimensions.lifestyle / 10) +
    0.05 * (dimensions.policy / 10)
  return Math.round(Math.max(0, Math.min(1, overall0to1)) * 100)
}

function answersRecord(answers: unknown): Record<string, unknown> | null {
  if (answers == null || typeof answers !== 'object' || Array.isArray(answers)) return null
  return answers as Record<string, unknown>
}

/**
 * Affordability for the rent score. Stated income plus a rental-budget choice
 * replaces the stored component. Otherwise the stored component is kept, so a
 * missing or unverified income figure does not zero a score that already counted.
 */
export function withStatedIncomeAffordability(
  dimensions: RentScoreDimensions,
  answers: unknown,
  incomeVerified: boolean,
): RentScoreDimensions {
  const record = answersRecord(answers)
  const stated = parseStatedMonthlyIncome(record?.monthly_income)
  const rent = rentalBudgetMonthlyRent(record?.rental_budget)
  if (stated == null || rent <= 0) return { ...dimensions }
  return {
    ...dimensions,
    affordability: affordabilityFromStatedIncome({
      rent,
      statedMonthlyIncome: stated,
      incomeVerified,
    }),
  }
}

export function rentScoreFromQuestionnaireRow(
  row: {
    answers?: unknown
    affordability_score?: unknown
    stability_score?: unknown
    payment_risk_score?: unknown
    lifestyle_score?: unknown
    space_fit_score?: unknown
  },
  incomeVerified: boolean,
): { score: number; dimensions: RentScoreDimensions } {
  const dimensions = withStatedIncomeAffordability(
    {
      affordability: normalizeRentScoreDimension(row.affordability_score),
      stability: normalizeRentScoreDimension(row.stability_score),
      risk: normalizeRentScoreDimension(row.payment_risk_score),
      lifestyle: normalizeRentScoreDimension(row.lifestyle_score),
      policy: normalizeRentScoreDimension(row.space_fit_score),
    },
    row.answers,
    incomeVerified,
  )
  return { score: computeRentScore(dimensions), dimensions }
}

/**
 * Per-listing match affordability. Uses stated income against that listing's
 * rent when present; otherwise the stored component. Verification is ignored.
 */
export function matchAffordabilityFromStatedIncome(input: {
  rent: number
  statedMonthlyIncome: unknown
  storedAffordability: number
  incomeVerified: boolean
}): number {
  const stated = parseStatedMonthlyIncome(input.statedMonthlyIncome)
  if (stated != null && input.rent > 0) {
    return affordabilityFromStatedIncome({
      rent: input.rent,
      statedMonthlyIncome: stated,
      incomeVerified: input.incomeVerified,
    })
  }
  const stored = Number(input.storedAffordability)
  return Number.isFinite(stored) ? stored : 0
}
