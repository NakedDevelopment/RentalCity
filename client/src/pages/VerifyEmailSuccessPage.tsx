import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

type LocationState = {
  email?: string
}

export function VerifyEmailSuccessPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [redirectChecked, setRedirectChecked] = useState(false)
  const state = (location.state as LocationState | null) ?? null
  const email = state?.email ?? 'useremail@email.com'

  useEffect(() => {
    if (!user) {
      setRedirectChecked(true)
      return
    }
    let cancelled = false
    async function checkAndRedirect() {
      const signedUpAsLandlord = user?.user_metadata?.role === 'landlord'
      const { data } = await supabase.from('profiles').select('role, display_name').eq('id', user.id).maybeSingle()
      if (cancelled) return
      let isLandlord = data?.role === 'landlord'
      if (signedUpAsLandlord && !isLandlord) {
        await supabase.from('profiles').update({ role: 'landlord' }).eq('id', user.id)
        isLandlord = true
      }
      const hasDisplayName = !!data?.display_name?.trim()
      if (isLandlord && !hasDisplayName) {
        navigate('/onboarding/profile', { replace: true })
        return
      }
      setRedirectChecked(true)
    }
    checkAndRedirect()
    return () => { cancelled = true }
  }, [user, navigate])

  if (!redirectChecked) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[322px]">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-7 shadow-sm">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900 text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
          </div>

          <h1 className="mb-2 text-center text-[2rem] font-medium text-gray-900">Email Verified!</h1>
          <p className="mb-6 text-center text-sm text-gray-600">
            Your email address has been successfully verified
          </p>

          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-5 text-center">
            <div className="mb-3 flex justify-center text-gray-600">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <p className="mb-4 text-sm leading-7 text-gray-700">
              Great! Your email address has been verified and your account is now active.
            </p>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900">
              <div>{email}</div>
              <div className="mt-1 flex items-center justify-center gap-1 text-xs text-gray-600">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Verified
              </div>
            </div>
            <p className="mt-4 text-sm leading-7 text-gray-600">
              You can now continue with your rental application and start finding your perfect match.
            </p>
          </div>

          <div className="mt-5 space-y-4">
            <Link
              to="/applications/apply"
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 text-center text-sm font-medium text-white hover:bg-primary/90"
            >
              Continue to Application
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-800">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h13M9 5v6h13M5 5h.01M5 12h.01M5 19h.01" />
                </svg>
                What&apos;s Next?
              </div>
              <ul className="space-y-2 text-xs text-gray-600">
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-600" />
                  Email verified successfully
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  Complete your rental application
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  Take personality survey
                </li>
                <li className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-gray-300" />
                  Start finding compatible matches
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
