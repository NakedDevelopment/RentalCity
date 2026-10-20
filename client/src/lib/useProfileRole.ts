import { useCallback, useEffect, useRef, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type ProfileRole = 'tenant' | 'landlord' | 'admin'

export type UseProfileRoleResult = {
  role: ProfileRole | null
  displayName: string | null
  /** Set when role is landlord and they have completed the onboarding survey */
  landlordSurveyCompletedAt: string | null
  /** Set when role is tenant and they have completed the compatibility survey */
  tenantSurveyCompletedAt: string | null
  /** Set when the tenant has passed Plaid Identity Verification */
  identityVerifiedAt: string | null
  loading: boolean
  /** Call to refetch profile (e.g. after completing questionnaire so matches page has fresh survey state) */
  refetch: () => Promise<void>
}

/**
 * Returns the current user's profile role (and displayName). Never defaults to tenant
 * so that landlords never see tenant UI while role is loading.
 */
export function useProfileRole(user: User | null): UseProfileRoleResult {
  const userRef = useRef(user)
  userRef.current = user

  const [role, setRole] = useState<ProfileRole | null>(null)
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [landlordSurveyCompletedAt, setLandlordSurveyCompletedAt] = useState<string | null>(null)
  const [tenantSurveyCompletedAt, setTenantSurveyCompletedAt] = useState<string | null>(null)
  const [identityVerifiedAt, setIdentityVerifiedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(!!user)

  const refetch = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('role, display_name, landlord_survey_completed_at, tenant_survey_completed_at, identity_verified_at')
      .eq('id', user.id)
      .maybeSingle()

    const dbRole = data?.role as string | undefined
    let resolved: ProfileRole =
      dbRole === 'admin' ? 'admin' : dbRole === 'landlord' || dbRole === 'listing_agent' ? 'landlord' : 'tenant'
    const metaRole = user.user_metadata?.role as string | undefined
    const signedUpAsLandlord = metaRole === 'landlord' || metaRole === 'listing_agent'
    if (resolved !== 'admin' && signedUpAsLandlord && dbRole !== 'landlord' && dbRole !== 'listing_agent') {
      await supabase.from('profiles').update({ role: metaRole === 'listing_agent' ? 'listing_agent' : 'landlord' }).eq('id', user.id)
      resolved = 'landlord'
    }

    setRole(resolved)
    setDisplayName(data?.display_name?.trim() || null)
    setLandlordSurveyCompletedAt(data?.landlord_survey_completed_at ?? null)
    setTenantSurveyCompletedAt(data?.tenant_survey_completed_at ?? null)
    setIdentityVerifiedAt(data?.identity_verified_at ?? null)
    setLoading(false)
  }, [user])

  // Key off user id only: Supabase often emits new `user` object references (e.g. token refresh) without
  // the id changing; re-running the full load would set loading=true and flicker admin (and other) shells.
  const userId = user?.id

  useEffect(() => {
    if (!userId) {
      setRole(null)
      setDisplayName(null)
      setLandlordSurveyCompletedAt(null)
      setTenantSurveyCompletedAt(null)
      setIdentityVerifiedAt(null)
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)

    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('role, display_name, landlord_survey_completed_at, tenant_survey_completed_at, identity_verified_at')
        .eq('id', userId)
        .maybeSingle()

      if (cancelled) return

      const currentUserAfter = userRef.current
      if (!currentUserAfter || currentUserAfter.id !== userId) {
        setLoading(false)
        return
      }

      const dbRole = data?.role as string | undefined
      let resolved: ProfileRole =
        dbRole === 'admin' ? 'admin' : dbRole === 'landlord' || dbRole === 'listing_agent' ? 'landlord' : 'tenant'
      const metaRole = currentUserAfter.user_metadata?.role as string | undefined
      const signedUpAsLandlord = metaRole === 'landlord' || metaRole === 'listing_agent'

      if (resolved !== 'admin' && signedUpAsLandlord && dbRole !== 'landlord' && dbRole !== 'listing_agent') {
        await supabase.from('profiles').update({ role: metaRole === 'listing_agent' ? 'listing_agent' : 'landlord' }).eq('id', userId)
        resolved = 'landlord'
      }

      setRole(resolved)
      setDisplayName(data?.display_name?.trim() || null)
      setLandlordSurveyCompletedAt(data?.landlord_survey_completed_at ?? null)
      setTenantSurveyCompletedAt(data?.tenant_survey_completed_at ?? null)
      setIdentityVerifiedAt(data?.identity_verified_at ?? null)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [userId])

  return { role, displayName, landlordSurveyCompletedAt, tenantSurveyCompletedAt, identityVerifiedAt, loading, refetch }
}
