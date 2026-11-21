/**
 * Tenant “Rent Score” (0–100) shown on matches and landlord tenant profile.
 * Derived from questionnaire dimension columns so it stays in sync when overall_score is stale.
 * Affordability is recomputed from stated income; verification does not change it.
 */

import {
  computeRentScore,
  normalizeRentScoreDimension,
  type RentScoreDimensions,
} from '../../../shared/rentScore'

export { rentScoreFromQuestionnaireRow } from '../../../shared/rentScore'

export type TenantRentScoreDimensions = RentScoreDimensions

/** DB columns may be 0–10 or legacy 0–100. */
export function normalizeTenantQuestionnaireDimension(v: unknown): number {
  return normalizeRentScoreDimension(v)
}

export function dimensionsFromTenantQuestionnaireRow(row: {
  affordability_score?: unknown
  stability_score?: unknown
  payment_risk_score?: unknown
  lifestyle_score?: unknown
  space_fit_score?: unknown
}): TenantRentScoreDimensions {
  return {
    affordability: normalizeTenantQuestionnaireDimension(row.affordability_score),
    stability: normalizeTenantQuestionnaireDimension(row.stability_score),
    risk: normalizeTenantQuestionnaireDimension(row.payment_risk_score),
    lifestyle: normalizeTenantQuestionnaireDimension(row.lifestyle_score),
    policy: normalizeTenantQuestionnaireDimension(row.space_fit_score),
  }
}

export function computeTenantRentScoreFromDimensions(dimensions: TenantRentScoreDimensions): number {
  return computeRentScore(dimensions)
}

/** Bar weights in the score breakdown UI (matches Your Matches dialog; sum = 1). */
export const TENANT_RENT_SCORE_BREAKDOWN_WEIGHTS: Record<keyof TenantRentScoreDimensions, number> = {
  affordability: 0.35,
  stability: 0.25,
  risk: 0.2,
  lifestyle: 0.1,
  policy: 0.1,
}

export const TENANT_RENT_SCORE_BREAKDOWN_ROWS: {
  key: keyof TenantRentScoreDimensions
  emoji: string
  label: string
}[] = [
  { key: 'affordability', emoji: '💰', label: 'Affordability' },
  { key: 'stability', emoji: '🏠', label: 'Stability' },
  { key: 'risk', emoji: '🛡️', label: 'Payment risk' },
  { key: 'lifestyle', emoji: '✨', label: 'Lifestyle' },
  { key: 'policy', emoji: '📋', label: 'Space fit' },
]

export function tenantRentScoreBreakdownContribution(
  key: keyof TenantRentScoreDimensions,
  score: number,
): number {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0
  return (safe / 10) * (TENANT_RENT_SCORE_BREAKDOWN_WEIGHTS[key] * 100)
}

export function tenantRentScoreBreakdownMax(key: keyof TenantRentScoreDimensions): number {
  return TENANT_RENT_SCORE_BREAKDOWN_WEIGHTS[key] * 100
}

export function formatTenantRentScoreContribution(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
