import { useEffect } from 'react'
import { supabase } from './supabase'
import {
  isTenantFunnelStep,
  recordTenantFunnelLink,
  recordTenantFunnelStep,
  type TenantFunnelStepId,
} from '../../../shared/tenantFunnel'

const ANONYMOUS_ID_KEY = 'rc_funnel_anonymous_id'
const SIGNUP_ROLE_KEY = 'rc_signup_role'

function storageGet(store: Storage, key: string): string | null {
  try {
    return store.getItem(key)
  } catch {
    return null
  }
}

function storageSet(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value)
  } catch {
    /* storage is optional; tracking still tries to insert */
  }
}

function anonymousId(): string | null {
  const existing = storageGet(localStorage, ANONYMOUS_ID_KEY)
  if (existing && existing.length <= 64) return existing
  const next = crypto.randomUUID()
  storageSet(localStorage, ANONYMOUS_ID_KEY, next)
  return next
}

function storedAnonymousId(): string | null {
  const existing = storageGet(localStorage, ANONYMOUS_ID_KEY)
  if (!existing) return null
  const trimmed = existing.trim()
  if (!trimmed || trimmed.length > 64) return null
  return trimmed
}

/** Link the stored anonymous id to the signed-in user. A failed insert is ignored. */
function linkAnonymousTenant(userId: string): void {
  const anonymous = storedAnonymousId()
  if (!anonymous) return
  const dedupeKey = `rc_funnel_linked:${userId}:${anonymous}`
  if (storageGet(sessionStorage, dedupeKey)) return

  void recordTenantFunnelLink({ userId, anonymousId: anonymous }, async (row) => {
    const { error } = await supabase.from('funnel_identity_links').insert(row)
    if (!error || error.code === '23505') storageSet(sessionStorage, dedupeKey, '1')
    return { error: error ? { message: error.message } : null }
  }).catch(() => {})
}

/** Remember which signup path was chosen so later pre-auth screens stay tenant-only. */
export function rememberSignupRole(role: string) {
  storageSet(sessionStorage, SIGNUP_ROLE_KEY, role)
}

export function rememberedSignupRole(): string | null {
  return storageGet(sessionStorage, SIGNUP_ROLE_KEY)
}

/**
 * Record that a tenant reached a step. Returns immediately.
 * A failed insert is ignored and does not affect navigation.
 */
export function trackTenantStep(step: TenantFunnelStepId, userId: string | null): void {
  try {
    if (!isTenantFunnelStep(step)) return
    if (userId) linkAnonymousTenant(userId)
    const anonymous = userId ? null : anonymousId()
    const dedupeKey = `rc_funnel_seen:${userId ?? anonymous ?? 'none'}:${step}`
    if (storageGet(sessionStorage, dedupeKey)) return

    void recordTenantFunnelStep(step, { userId, anonymousId: anonymous }, async (row) => {
      const { error } = await supabase.from('funnel_events').insert(row)
      return { error: error ? { message: error.message } : null }
    })
      .then((ok) => {
        if (ok) storageSet(sessionStorage, dedupeKey, '1')
      })
      .catch(() => {})
  } catch {
    /* a tracking failure must not affect navigation */
  }
}

export function useTrackTenantStep(
  step: TenantFunnelStepId,
  userId: string | null | undefined,
  metadataRole?: string | null,
) {
  useEffect(() => {
    if (!userId) return
    if (metadataRole === 'landlord' || metadataRole === 'listing_agent' || metadataRole === 'admin') return
    trackTenantStep(step, userId)
  }, [step, userId, metadataRole])
}
