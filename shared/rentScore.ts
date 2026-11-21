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

export type QuestionnaireRentScoreRow = {
  overall_score?: unknown
  answers?: unknown
  affordability_score?: unknown
  stability_score?: unknown
  payment_risk_score?: unknown
  lifestyle_score?: unknown
  space_fit_score?: unknown
}

/**
 * Affordability input for the rent score. Stated income and a rental-budget
 * choice replace the stored column. Verification is not an input. When either
 * figure is missing, the caller keeps the stored column so a blank income
 * does not zero a score that already counted.
 */
export function statedIncomeAffordability(
  row: QuestionnaireRentScoreRow,
  incomeVerified: boolean,
): number | null {
  const record = answersRecord(row.answers)
  const stated = parseStatedMonthlyIncome(record?.monthly_income)
  const rent = rentalBudgetMonthlyRent(record?.rental_budget)
  if (stated == null || rent <= 0) return null
  return affordabilityFromStatedIncome({
    rent,
    statedMonthlyIncome: stated,
    incomeVerified,
  })
}

/**
 * Tenant rent score, 0–100, or null when nothing has been scored.
 *
 * Same rules as tenantDisplayScoreFromQuestionnaire before PR #2: a finite
 * overall_score is returned as-is, otherwise the equal average of
 * affordability, stability, payment risk, and lifestyle (a missing value
 * counts as 5) times 10. Space fit is not an input. The one exception is
 * affordability: a stated income and rental budget replace that column,
 * whether or not the income is verified.
 */
export function tenantRentScoreFromQuestionnaire(
  row: QuestionnaireRentScoreRow,
  incomeVerified: boolean,
): number | null {
  if (row.overall_score != null && Number.isFinite(Number(row.overall_score))) {
    return Math.round(Number(row.overall_score))
  }
  const stated = statedIncomeAffordability(row, incomeVerified)
  const a = Number(stated != null ? stated : row.affordability_score)
  const s = Number(row.stability_score)
  const p = Number(row.payment_risk_score)
  const l = Number(row.lifestyle_score)
  const vals = [a, s, p, l].map((v) => (Number.isFinite(v) ? v : null))
  if (vals.some((v) => v != null)) {
    const nums = vals.map((v) => (v != null ? v : 5))
    return Math.round(((nums[0] + nums[1] + nums[2] + nums[3]) / 4) * 10)
  }
  return null
}

export function rentScoreFromQuestionnaireRow(
  row: QuestionnaireRentScoreRow,
  incomeVerified: boolean,
): { score: number | null; dimensions: RentScoreDimensions } {
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
  return { score: tenantRentScoreFromQuestionnaire(row, incomeVerified), dimensions }
}

/**
 * Every tenant and landlord rent-score surface calls the same function.
 * The names are the call sites; they are not separate formulas.
 */
export const tenantYourMatchesRentScore = rentScoreFromQuestionnaireRow
export const landlordTenantProfileRentScore = rentScoreFromQuestionnaireRow
export const landlordCatalogRentScore = rentScoreFromQuestionnaireRow
export const matchesForLandlordRentScore = rentScoreFromQuestionnaireRow
export const matchesForTenantRentScore = rentScoreFromQuestionnaireRow

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
