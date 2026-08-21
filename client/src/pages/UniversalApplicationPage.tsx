import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import StripeCheckoutModal from '../components/StripeCheckoutModal'
import { stripeConfigured } from '../lib/stripe'

const NEW_APPLICATION_FEE = 50
const UPDATE_APPLICATION_FEE = 50
const INCLUDED_ITEMS = [
  'Professional background check',
  'Comprehensive credit report',
  'Access to all rental applications',
  '6 months of unlimited property applications',
]

function formatValidUntil(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

export function UniversalApplicationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [hasExistingApplication, setHasExistingApplication] = useState(false)
  const [existingValidUntil, setExistingValidUntil] = useState<string | null>(null)
  const [renewMode, setRenewMode] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [clientSecret, setClientSecret] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const applicationFee = hasExistingApplication ? UPDATE_APPLICATION_FEE : NEW_APPLICATION_FEE

  // Warn before closing/refreshing the tab while the Stripe modal is open.
  useEffect(() => {
    if (!checkoutOpen) return
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [checkoutOpen])

  useEffect(() => {
    async function loadHistory() {
      if (!user) {
        setLoadingHistory(false)
        return
      }
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('universal_applications')
        .select('id, valid_until')
        .eq('tenant_id', user.id)
        .eq('status', 'active')
        .gt('valid_until', nowIso)
        .limit(1)

      const active = data ?? []
      setHasExistingApplication(active.length > 0)
      if (active.length > 0) {
        setExistingValidUntil((active[0] as { valid_until: string }).valid_until)
      }
      setLoadingHistory(false)
    }
    loadHistory()
  }, [user])

  // Handle the redirect back from Stripe Checkout.
  useEffect(() => {
    const checkout = searchParams.get('checkout')
    const sessionId = searchParams.get('session_id')

    if (checkout === 'cancel') {
      setCanceled(true)
      return
    }
    if (checkout !== 'success' || !sessionId) return

    let active = true
    async function confirmPayment() {
      setConfirming(true)
      setError(null)
      try {
        const { data: session } = await supabase.auth.getSession()
        const accessToken = session.session?.access_token
        if (!accessToken) throw new Error('Your session expired. Please sign in again.')

        const res = await fetch('/api/stripe/universal-application/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ sessionId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || 'We could not confirm your payment.')
        }
        if (active) navigate('/account/rental-application', { replace: true })
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Something went wrong confirming your payment.')
          setConfirming(false)
        }
      }
    }
    confirmPayment()
    return () => {
      active = false
    }
  }, [searchParams, navigate])

  async function handleCheckout() {
    setError(null)
    setCanceled(false)
    if (!user) {
      setError('Your session expired. Please sign in again.')
      return
    }
    setStarting(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session.session?.access_token
      if (!accessToken) throw new Error('Your session expired. Please sign in again.')

      const res = await fetch('/api/stripe/universal-application/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tenantId: user.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Could not start checkout. Please try again.')
      }
      const json = (await res.json()) as {
        clientSecret?: string
        demo?: boolean
        universalApplicationId?: string | null
      }

      // Demo bypass (dev only): payment was skipped and access granted server-side.
      if (json.demo) {
        navigate('/account/rental-application', { replace: true })
        return
      }

      if (!json.clientSecret) throw new Error('Could not start checkout. Please try again.')
      if (!stripeConfigured) {
        throw new Error('Payments are not configured yet. Please try again later.')
      }
      setClientSecret(json.clientSecret)
      setCheckoutOpen(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
    } finally {
      setStarting(false)
    }
  }

  // Show "Already paid" screen when the user has an active application and hasn't
  // explicitly chosen to renew. This prevents the back-button re-charge loop.
  const showAlreadyPaid = !loadingHistory && hasExistingApplication && !renewMode && !confirming

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:p-10">

        {/* ── Already-paid screen ── */}
        {showAlreadyPaid ? (
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>

            <h1 className="mb-3 text-center text-[2rem] font-medium text-gray-900">
              You're already paid
            </h1>
            <p className="mx-auto mb-8 max-w-md text-center text-sm leading-7 text-gray-600">
              Your universal application is active
              {existingValidUntil ? ` through ${formatValidUntil(existingValidUntil)}` : ''}.
              You don't need to pay again — just continue to your application.
            </p>

            <div className="max-w-xl mx-auto space-y-4">
              <Link
                to="/account/rental-application"
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl btn-primary py-3 text-sm font-medium text-white"
              >
                Continue to my application
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              <div className="border-t border-gray-100 pt-4 text-center">
                <p className="text-xs text-gray-400 mb-2">Want to renew early for another 6 months?</p>
                <button
                  type="button"
                  onClick={() => setRenewMode(true)}
                  className="text-sm text-gray-500 underline hover:text-gray-700"
                >
                  Renew application ($50)
                </button>
              </div>
            </div>
          </>
        ) : (
          /* ── Normal pay / confirm screen ── */
          <>
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-9 4h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <h1 className="mb-3 text-center text-[2rem] font-medium text-gray-900">
              {renewMode ? 'Renew your application' : hasExistingApplication ? 'Update your application' : 'Start your application'}
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-7 text-gray-600">
              {renewMode || hasExistingApplication
                ? 'Your $50 application fee refreshes your background and credit checks and keeps your profile current for another 6 months.'
                : 'One $50 application fee covers your background and credit checks and lets you apply to any property for the next 6 months.'}
            </p>

            <div className="mb-8 rounded-xl bg-gray-50 px-6 py-6 text-center">
              <div className="flex items-center justify-center gap-3 text-gray-900">
                <span className="text-4xl font-semibold">${applicationFee}</span>
                <span className="text-xl text-gray-600">Application Fee</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                {renewMode || hasExistingApplication ? 'Update application checks' : 'Valid for 6 months • Covers all properties'}
              </p>
            </div>

            <h2 className="mb-6 text-center text-[1.5rem] font-medium text-gray-900">What&apos;s included:</h2>
            <ul className="mx-auto mb-8 max-w-xl space-y-4">
              {INCLUDED_ITEMS.map((item) => (
                <li key={item} className="flex items-center gap-3 text-base text-gray-700">
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gray-900">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>

            <div className="max-w-xl mx-auto space-y-6">
              {confirming ? (
                <div className="rounded-xl bg-gray-50 px-4 py-8 text-center">
                  <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
                  <p className="text-sm text-gray-700">Confirming your payment…</p>
                </div>
              ) : (
                <>
                  {error && (
                    <div className="rounded-xl bg-red-50 px-4 py-3 text-red-800 text-center text-sm">
                      {error}
                    </div>
                  )}
                  {canceled && !error && (
                    <div className="rounded-xl bg-amber-50 px-4 py-3 text-amber-800 text-center text-sm">
                      Payment canceled. You can try again whenever you&apos;re ready.
                    </div>
                  )}

                  <div className="pt-2 space-y-4">
                    {user ? (
                      <>
                        <button
                          type="button"
                          onClick={handleCheckout}
                          disabled={loadingHistory || starting}
                          className="inline-flex w-full items-center justify-center gap-3 rounded-xl btn-primary py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {loadingHistory || starting ? (
                            'Processing…'
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.657 0-3 .895-3 2v2h6v-2c0-1.105-1.343-2-3-2zm6 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2a2 2 0 012-2V9a4 4 0 118 0v2a2 2 0 012 2zm-6-8a2 2 0 00-2 2v2h4V7a2 2 0 00-2-2z" />
                              </svg>
                              {renewMode || hasExistingApplication
                                ? `Pay $${applicationFee} & Renew Application`
                                : `Pay $${applicationFee} & Continue to Application`}
                            </>
                          )}
                        </button>

                        {renewMode ? (
                          <button
                            type="button"
                            onClick={() => setRenewMode(false)}
                            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Back
                          </button>
                        ) : (
                          <Link
                            to="/matches?tab=applied"
                            className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </Link>
                        )}
                      </>
                    ) : (
                      <>
                        <Link
                          to="/signup"
                          className="inline-flex w-full items-center justify-center gap-3 rounded-xl btn-primary py-3 text-sm font-medium text-white"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.657 0-3 .895-3 2v2h6v-2c0-1.105-1.343-2-3-2zm6 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2a2 2 0 012-2V9a4 4 0 118 0v2a2 2 0 012 2zm-6-8a2 2 0 00-2 2v2h4V7a2 2 0 00-2-2z" />
                          </svg>
                          {`Pay $${applicationFee} & Continue to Application`}
                        </Link>

                        <Link
                          to="/matches?tab=applied"
                          className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Cancel
                        </Link>
                      </>
                    )}

                    <div className="text-center text-sm text-gray-500">
                      <span className="inline-flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Secure payment processed by Stripe
                      </span>
                    </div>

                    <div className="border-t border-gray-200 pt-6 text-center">
                      <p className="text-sm text-gray-700">Questions about the fee?</p>
                      <Link to="/support" className="text-sm underline text-gray-900 hover:text-gray-700">
                        Contact support
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <StripeCheckoutModal
        open={checkoutOpen}
        onClose={() => {
          setCheckoutOpen(false)
          setClientSecret(null)
        }}
        clientSecret={clientSecret}
        title={renewMode || hasExistingApplication ? 'Renew your application' : 'Complete your application'}
      />
    </div>
  )
}
