export const TENANT_FUNNEL_STEPS = [
  { id: 'signup_role', label: 'Choose tenant', group: 'Sign-up' },
  { id: 'signup_account', label: 'Create account', group: 'Sign-up' },
  { id: 'signup_verify_email', label: 'Check your email', group: 'Sign-up' },
  { id: 'signup_verified', label: 'Email verified', group: 'Sign-up' },
  { id: 'onboarding_role', label: 'Confirm role', group: 'Sign-up' },
  { id: 'rental_needs', label: 'Rental needs', group: 'Sign-up' },
  { id: 'lease_preferences', label: 'Lease preferences', group: 'Sign-up' },
  { id: 'tenant_questionnaire', label: 'Questionnaire', group: 'Sign-up' },
  { id: 'identity_verification', label: 'Identity verification', group: 'Sign-up' },
  { id: 'application_start', label: 'Start application', group: 'Application' },
  { id: 'application_personal', label: 'Personal information', group: 'Application' },
  { id: 'application_emergency', label: 'Emergency contact', group: 'Application' },
  { id: 'application_plans', label: 'Your plans', group: 'Application' },
  { id: 'application_authorization', label: 'Authorization', group: 'Application' },
  { id: 'application_income', label: 'Income verification', group: 'Application' },
  { id: 'application_complete', label: 'Application complete', group: 'Application' },
] as const

export type TenantFunnelStepId = (typeof TENANT_FUNNEL_STEPS)[number]['id']

export type FunnelEventInsert = {
  step: string
  user_type: 'tenant'
  user_id: string | null
  anonymous_id: string | null
}

export type FunnelEventRow = {
  step: string
  user_id: string | null
  anonymous_id: string | null
}

export type FunnelStepStat = {
  id: TenantFunnelStepId
  label: string
  group: 'Sign-up' | 'Application'
  reached: number
  stopped: number
}

const STEP_INDEX = new Map<string, number>(TENANT_FUNNEL_STEPS.map((step, index) => [step.id, index]))

export function isTenantFunnelStep(step: string): step is TenantFunnelStepId {
  return STEP_INDEX.has(step)
}

type InsertResult = { error: { message?: string } | null } | null | undefined

function cleanId(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > max) return null
  return trimmed
}

/**
 * Insert one tenant funnel event. Failures resolve to false and never throw.
 * The inserted row is only step, user type, and one id.
 */
export async function recordTenantFunnelStep(
  step: string,
  identity: { userId?: string | null; anonymousId?: string | null },
  insert: (row: FunnelEventInsert) => Promise<InsertResult>,
): Promise<boolean> {
  try {
    const name = step.trim()
    if (!isTenantFunnelStep(name)) return false
    const userId = cleanId(identity.userId, 64)
    const anonymousId = userId ? null : cleanId(identity.anonymousId, 64)
    if (!userId && !anonymousId) return false
    const row: FunnelEventInsert = {
      step: name,
      user_type: 'tenant',
      user_id: userId,
      anonymous_id: anonymousId,
    }
    const result = await insert(row)
    return !result?.error
  } catch {
    return false
  }
}

function actorKey(row: FunnelEventRow): string | null {
  const userId = cleanId(row.user_id, 64)
  if (userId) return `user:${userId}`
  const anonymousId = cleanId(row.anonymous_id, 64)
  if (anonymousId) return `anon:${anonymousId}`
  return null
}

/** Distinct tenants who reached each step, and how many stopped at that step. */
export function aggregateTenantFunnel(rows: FunnelEventRow[]): FunnelStepStat[] {
  const reached = TENANT_FUNNEL_STEPS.map(() => new Set<string>())
  const furthest = new Map<string, number>()

  for (const row of rows) {
    const index = STEP_INDEX.get(row.step)
    const actor = actorKey(row)
    if (index == null || !actor) continue
    reached[index].add(actor)
    const previous = furthest.get(actor)
    if (previous == null || index > previous) furthest.set(actor, index)
  }

  const stopped = TENANT_FUNNEL_STEPS.map(() => 0)
  for (const index of furthest.values()) stopped[index] += 1

  return TENANT_FUNNEL_STEPS.map((step, index) => ({
    id: step.id,
    label: step.label,
    group: step.group,
    reached: reached[index].size,
    stopped: stopped[index],
  }))
}
