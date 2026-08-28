import { useEffect, useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { getDocusignStatus } from '../lib/docusignApi'
import { supabase } from '../lib/supabase'

export function LandlordAgreementGate() {
  const [state, setState] = useState<'loading' | 'allowed' | 'blocked'>('loading')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) {
          if (!cancelled) setState('blocked')
          return
        }
        const status = await getDocusignStatus(token)
        if (!cancelled) setState(status.agreementsSigned ? 'allowed' : 'blocked')
      } catch {
        if (!cancelled) setState('blocked')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (state === 'loading') {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="text-sm text-gray-500">Checking agreement status…</span>
      </div>
    )
  }

  return state === 'allowed' ? <Outlet /> : <Navigate to="/onboarding/property/intro" replace />
}