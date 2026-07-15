import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

/**
 * Safety net for Supabase password-recovery links that land anywhere other
 * than /reset-password (e.g. when the email link falls back to the Site URL
 * root). Detects the recovery redirect and forwards the user to the reset
 * form before any role-based redirect (landlord dashboard, etc.) kicks in.
 */
export function RecoveryLinkHandler() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (location.pathname === '/reset-password') return

    // Case 1: the recovery token is still in the URL — forward it intact.
    const hash = window.location.hash.replace(/^#/, '')
    const hashParams = new URLSearchParams(hash)
    const searchParams = new URLSearchParams(window.location.search)
    const isRecoveryType = hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
    const hasToken = Boolean(hashParams.get('access_token') || searchParams.get('code'))
    if (isRecoveryType && hasToken) {
      navigate(`/reset-password${window.location.search}${window.location.hash}`, {
        replace: true,
        state: { recovery: true },
      })
      return
    }

    // Case 2: the SDK already consumed the token and fired PASSWORD_RECOVERY.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate('/reset-password', { replace: true, state: { recovery: true } })
      }
    })
    return () => subscription.unsubscribe()
  }, [location.pathname, navigate])

  return null
}
