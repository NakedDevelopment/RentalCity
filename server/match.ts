/**
 * Match scoring logic for server-side API. Mirrors client/src/lib/matchScoring.ts
 * and derivation from landlord/tenant questionnaire answers.
 */

const BOOST_SAFE_TENANT_FOR_FLEXIBLE_LANDLORD = true

function hasChoice(
  answer: string | string[] | null | undefined,
  id: string
): boolean {
  if (!answer) return false
  if (Array.isArray(answer)) return answer.includes(id)
  return answer === id
}

export function landlordAnswersToPrefs(answers: Record<string, unknown> & {
  policy_strictness_score?: number
  risk_tolerance_score?: number
  accepts_housing_vouchers?: boolean | string | null
}) {
  let maxEviction: number | null = null
  const ev = answers?.eviction_policy as string | string[] | undefined
  if (hasChoice(ev, 'e') || hasChoice(ev, 'd')) maxEviction = 48
  else if (hasChoice(ev, 'c')) maxEviction = 36
  else if (hasChoice(ev, 'b')) maxEviction = 24
  else if (hasChoice(ev, 'a')) maxEviction = 12

  let maxBankruptcy: number | null = null
  const bk = answers?.bankruptcy_policy as string | string[] | undefined
  if (hasChoice(bk, 'e') || hasChoice(bk, 'd')) maxBankruptcy = 48
  else if (hasChoice(bk, 'c')) maxBankruptcy = 36
  else if (hasChoice(bk, 'b')) maxBankruptcy = 24
  else if (hasChoice(bk, 'a')) maxBankruptcy = 12

  let maxLateFees: number = 0
  const lt = answers?.late_payment_policy as string | string[] | undefined
  if (hasChoice(lt, 'e')) maxLateFees = Number.POSITIVE_INFINITY
  else if (hasChoice(lt, 'd')) maxLateFees = 4
  else if (hasChoice(lt, 'c')) maxLateFees = 3
  else if (hasChoice(lt, 'b')) maxLateFees = 2
  else if (hasChoice(lt, 'a')) maxLateFees = 1

  let conflictStyle = 5
  switch (answers?.conflict_handling_style as string | undefined) {
    case 'a': conflictStyle = 10; break
    case 'c': conflictStyle = 9; break
    case 'b': conflictStyle = 6; break
    case 'd': conflictStyle = 2; break
  }

  // Dedicated column (when selected server-side) is the source of truth; fall back to the raw answer.
  const voucherAnswer = answers?.accepts_housing_vouchers
  const acceptsHousingVouchers: boolean | null =
    typeof voucherAnswer === 'boolean'
      ? voucherAnswer
      : voucherAnswer === 'yes'
        ? true
        : voucherAnswer === 'no'
          ? false
          : null

  return {
    maxEvictionRecencyMonths: maxEviction,
    maxBankruptcyRecencyMonths: maxBankruptcy,
    maxLateFeesLastTwoYears: maxLateFees === 0 ? null : maxLateFees,
    conflictStyleScore: conflictStyle,
    policyStrictnessScore: answers?.policy_strictness_score ?? 5,
    riskToleranceScore: answers?.risk_tolerance_score ?? 5,
    acceptsHousingVouchers,
  }
}

/** Rent vs income: ≤30% = 10, ≤35% = 7, ≤40% = 5, else 0. Rent and monthlyIncome in same units (e.g. dollars). */
export function scoreRentToIncome(rent: number, monthlyIncome: number): number {
  if (!rent || !monthlyIncome || monthlyIncome <= 0) return 0
  const ratio = rent / monthlyIncome
  if (ratio <= 0.3) return 10
  if (ratio <= 0.35) return 7
  if (ratio <= 0.4) return 5
  return 0
}

export function tenantAnswersToHistory(answers: Record<string, unknown>) {
  const ev = answers?.eviction_history as string | undefined
  let evictionMonths: number | null = null
  if (ev && ev !== 'e') {
    if (ev === 'a') evictionMonths = 12
    else if (ev === 'b') evictionMonths = 24
    else if (ev === 'c') evictionMonths = 36
    else if (ev === 'd') evictionMonths = 48
  }

  const bk = answers?.bankruptcy_history as string | undefined
  let bankruptcyMonths: number | null = null
  if (bk && bk !== 'e') {
    if (bk === 'a') bankruptcyMonths = 12
    else if (bk === 'b') bankruptcyMonths = 24
    else if (bk === 'c') bankruptcyMonths = 36
    else if (bk === 'd') bankruptcyMonths = 48
  }

  const lt = answers?.late_fees_last_two_years as string | undefined
  let lateFees: number | null = null
  if (lt === 'e') lateFees = 0
  else if (lt === 'a') lateFees = 1
  else if (lt === 'b') lateFees = 2
  else if (lt === 'c') lateFees = 3
  else if (lt === 'd') lateFees = 4

  const voucherAnswer = answers?.participates_in_voucher_program
  const participatesInVoucherProgram =
    typeof voucherAnswer === 'boolean' ? voucherAnswer : voucherAnswer === 'yes'

  return {
    evictionRecencyMonths: evictionMonths,
    bankruptcyRecencyMonths: bankruptcyMonths,
    lateFeesLastTwoYears: lateFees,
    participatesInVoucherProgram,
  }
}

export type TenantDims = {
  affordability: number
  stability: number
  paymentRisk: number
  lifestyle: number
}

export type LandlordPrefs = {
  maxEvictionRecencyMonths: number | null
  maxBankruptcyRecencyMonths: number | null
  maxLateFeesLastTwoYears: number | null
  conflictStyleScore: number
  policyStrictnessScore: number
  riskToleranceScore: number
  acceptsHousingVouchers: boolean | null
}

export type TenantHistory = {
  evictionRecencyMonths: number | null
  bankruptcyRecencyMonths: number | null
  lateFeesLastTwoYears: number | null
  participatesInVoucherProgram: boolean
}

export type MatchDimensions = {
  affordability: number
  stability: number
  risk: number
  lifestyle: number
  policy: number
}

export type MatchResult = {
  eligible: boolean
  reasons: string[]
  overall: number
  dimensions: MatchDimensions
}

export function computeMatch(
  tenant: TenantDims,
  landlord: LandlordPrefs,
  tenantHistory: TenantHistory
): MatchResult {
  const reasons: string[] = []
  let eligible = true

  if (landlord.maxEvictionRecencyMonths === null && tenantHistory.evictionRecencyMonths !== null) {
    eligible = false
    reasons.push('Landlord does not accept prior evictions.')
  }
  if (landlord.maxBankruptcyRecencyMonths === null && tenantHistory.bankruptcyRecencyMonths !== null) {
    eligible = false
    reasons.push('Landlord does not accept prior bankruptcy.')
  }
  if (
    landlord.maxLateFeesLastTwoYears != null &&
    landlord.maxLateFeesLastTwoYears !== Number.POSITIVE_INFINITY &&
    tenantHistory.lateFeesLastTwoYears != null &&
    tenantHistory.lateFeesLastTwoYears > landlord.maxLateFeesLastTwoYears
  ) {
    eligible = false
    reasons.push('Too many late payments for this landlord\'s policy.')
  }
  if (tenantHistory.participatesInVoucherProgram && landlord.acceptsHousingVouchers === false) {
    eligible = false
    reasons.push('Landlord does not accept housing vouchers.')
  }

  if (!eligible) {
    return {
      eligible: false,
      reasons,
      overall: 0,
      dimensions: { affordability: 0, stability: 0, risk: 0, lifestyle: 0, policy: 0 },
    }
  }

  const affordability = tenant.affordability
  const stability = tenant.stability
  const tenantRiskLevel = 10 - tenant.paymentRisk
  let risk = Math.max(0, 10 - Math.abs(tenantRiskLevel - landlord.riskToleranceScore))
  const lifestyleGap = Math.abs(tenant.lifestyle - landlord.conflictStyleScore)
  const lifestyle = Math.max(0, 10 - lifestyleGap)
  let policy = Math.max(0, 10 - Math.abs(tenant.paymentRisk - landlord.policyStrictnessScore))

  if (BOOST_SAFE_TENANT_FOR_FLEXIBLE_LANDLORD && landlord.riskToleranceScore >= 7 && tenant.paymentRisk >= 8) {
    risk = Math.max(risk, 5)
    policy = Math.max(policy, 5)
  }

  const dimensions: MatchDimensions = {
    affordability,
    stability,
    risk,
    lifestyle,
    policy,
  }
  const overall0to1 =
    0.35 * (affordability / 10) +
    0.25 * (stability / 10) +
    0.2 * (risk / 10) +
    0.1 * (lifestyle / 10) +
    0.1 * (policy / 10)
  const overall = Math.round(overall0to1 * 100)

  return { eligible: true, reasons, overall, dimensions }
}
