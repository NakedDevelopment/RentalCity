import { useEffect, useRef } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { clearPendingLandlordInviteToken, getPendingLandlordInviteToken, setPendingInvitedProperty } from './pendingLandlordInvite'

/**
 * When a tenant signs in with a pending invite token in sessionStorage, redeem it once.
 */
export function useRedeemPendingLandlordInvite(
  user: User | null,
  profileRole: 'tenant' | 'landlord' | 'admin' | null,
  roleLoading: boolean,
) {
  const attempted = useRef(false)
  const lastUserId = useRef<string | undefined>(undefined)

  useEffect(() => {
    if (user?.id !== lastUserId.current) {
      attempted.current = false
      lastUserId.current = user?.id
    }
    if (roleLoading || !user || profileRole !== 'tenant') {
      return
    }
    const token = getPendingLandlordInviteToken()
    if (!token) return
    if (attempted.current) return
    attempted.current = true

    ;(async () => {
      const { data, error } = await supabase.rpc('redeem_landlord_invite', { invite_token: token })
      if (error) {
        attempted.current = false
        return
      }
      const row = data as { ok?: boolean; error?: string; property_id?: string | null } | null
      if (!row?.ok) {
        if (row?.error === 'tenants_only' || row?.error === 'invalid_token' || row?.error === 'active_invite') {
          clearPendingLandlordInviteToken()
        }
        attempted.current = false
        return
      }
      clearPendingLandlordInviteToken()
      if (row.property_id) setPendingInvitedProperty(user.id, row.property_id)
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('rental-city-invite-redeemed'))
      }
    })()
  }, [user?.id, profileRole, roleLoading])
}
