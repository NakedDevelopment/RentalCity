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

export type FunnelIdentityLinkInsert = {
  anonymous_id: string
  user_id: string
  user_type: 'tenant'
}

export type FunnelIdentityLink = {
  anonymous_id: string
  user_id: string
  user_type: 'tenant' | 'landlord'
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

/**
 * Insert one anonymous-id to user-id link. Failures resolve to false and never throw.
 * The inserted row is only the two ids and the user type.
 */
export async function recordTenantFunnelLink(
  identity: { userId?: string | null; anonymousId?: string | null },
  insert: (row: FunnelIdentityLinkInsert) => Promise<InsertResult>,
): Promise<boolean> {
  try {
    const userId = cleanId(identity.userId, 64)
    const anonymousId = cleanId(identity.anonymousId, 64)
    if (!userId || !anonymousId) return false
    const row: FunnelIdentityLinkInsert = {
      anonymous_id: anonymousId,
      user_id: userId,
      user_type: 'tenant',
    }
    const result = await insert(row)
    return !result?.error
  } catch {
    return false
  }
}

function anonymousUserIds(links: FunnelIdentityLink[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const link of links) {
    if (link.user_type !== 'tenant') continue
    const anonymousId = cleanId(link.anonymous_id, 64)
    const userId = cleanId(link.user_id, 64)
    if (!anonymousId || !userId || map.has(anonymousId)) continue
    map.set(anonymousId, userId)
  }
  return map
}

function actorKey(row: FunnelEventRow, anonToUser: Map<string, string>): string | null {
  const userId = cleanId(row.user_id, 64)
  if (userId) return `user:${userId}`
  const anonymousId = cleanId(row.anonymous_id, 64)
  if (!anonymousId) return null
  const linkedUserId = anonToUser.get(anonymousId)
  if (linkedUserId) return `user:${linkedUserId}`
  return `anon:${anonymousId}`
}

/** Distinct tenants who reached each step, and how many stopped at that step. */
export function aggregateTenantFunnel(
  rows: FunnelEventRow[],
  links: FunnelIdentityLink[] = [],
): FunnelStepStat[] {
  const anonToUser = anonymousUserIds(links)
  const reached = TENANT_FUNNEL_STEPS.map(() => new Set<string>())
  const furthest = new Map<string, number>()

  for (const row of rows) {
    const index = STEP_INDEX.get(row.step)
    const actor = actorKey(row, anonToUser)
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
