import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { startUniversalBackgroundCheck } from '../lib/backgroundChecksApi'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const NEW_APPLICATION_FEE = 125
const UPDATE_APPLICATION_FEE = 50
const INCLUDED_ITEMS = [
  'Professional background check',
  'Comprehensive credit report',
  'Access to all rental applications',
  '6 months of unlimited property applications',
]

function stripSpaces(s: string) {
  return s.replace(/\s/g, '')
}

export function UniversalApplicationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hasExistingApplication, setHasExistingApplication] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [cardNumber, setCardNumber] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [cvc, setCvc] = useState('')
  const [cardholderName, setCardholderName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const applicationFee = hasExistingApplication ? UPDATE_APPLICATION_FEE : NEW_APPLICATION_FEE

  useEffect(() => {
    async function loadHistory() {
      if (!user) {
        setLoadingHistory(false)
        return
      }
      const nowIso = new Date().toISOString()
      const { data } = await supabase
        .from('universal_applications')
        .select('id')
        .eq('tenant_id', user.id)
        .eq('status', 'active')
        .gt('valid_until', nowIso)
        .limit(1)

      // Fee applies based on whether they have an active universal/renewal subscription.
      setHasExistingApplication((data ?? []).length > 0)
      setLoadingHistory(false)
    }
    loadHistory()
  }, [user])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const digits = stripSpaces(cardNumber)
    if (digits.length < 13 || digits.length > 19 || !/^\d+$/.test(digits)) {
      setError('Enter a valid card number.')
      return
    }
    const expiryDigits = stripSpaces(expiryDate).replace('/', '')
    if (!/^\d{4}$/.test(expiryDigits)) {
      setError('Enter expiry as MM/YY (e.g. 12/25).')
      return
    }
    if (!/^\d{3,4}$/.test(stripSpaces(cvc))) {
      setError('Enter a valid CVC.')
      return
    }
    if (!cardholderName.trim()) {
      setError('Enter cardholder name.')
      return
    }
    setLoading(true)
    try {
      const { data: session } = await supabase.auth.getSession()
      const accessToken = session.session?.access_token
      if (!accessToken) {
        setError('Your session expired. Please sign in again.')
        return
      }

      const res = await fetch('/api/universal-applications/activate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ tenantId: user.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Checkout failed. Please try again.')
      }
      const json = (await res.json()) as { universalApplicationId?: string | null }
      const universalApplicationId = json.universalApplicationId ?? null
      if (universalApplicationId) {
        // Fire-and-forget: create/reuse screening row for this application window.
        startUniversalBackgroundCheck(accessToken, universalApplicationId).catch(() => {})
      }

      navigate('/account/rental-application', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm md:p-10">
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-gray-900 text-white flex items-center justify-center">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-9 4h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
        </div>

        <h1 className="mb-3 text-center text-[2rem] font-medium text-gray-900">
          {hasExistingApplication ? 'Update your application' : 'Start your application'}
        </h1>
        <p className="mx-auto mb-8 max-w-2xl text-center text-sm leading-7 text-gray-600">
          {hasExistingApplication
            ? 'A reduced update fee refreshes your application checks and keeps your profile current.'
            : 'A one-time application fee covers background checks and gives you access to apply for any property for the next 6 months.'}
        </p>

        <div className="mb-8 rounded-xl bg-gray-50 px-6 py-6 text-center">
          <div className="flex items-center justify-center gap-3 text-gray-900">
            <span className="text-4xl font-semibold">${applicationFee}</span>
            <span className="text-xl text-gray-600">Application Fee</span>
          </div>
          <p className="mt-2 text-sm text-gray-500">
            {hasExistingApplication ? 'Update application checks' : 'Valid for 6 months • Covers all properties'}
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

        <form onSubmit={handleSubmit} className="max-w-xl mx-auto space-y-6">
          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-red-800 text-center text-sm">
              {error}
            </div>
          )}
          <div>
            <label htmlFor="card-number" className="mb-2 block text-sm font-medium text-gray-800">
              Card Number
            </label>
            <div className="relative">
              <input
                id="card-number"
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                placeholder="1234 5678 9012 3456"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
              />
              <svg className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-9 4h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="expiry-date" className="mb-2 block text-sm font-medium text-gray-800">
                Expiry Date
              </label>
              <input
                id="expiry-date"
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                placeholder="MM/YY"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div>
              <label htmlFor="cvc" className="mb-2 block text-sm font-medium text-gray-800">
                CVC
              </label>
              <input
                id="cvc"
                type="text"
                value={cvc}
                onChange={(e) => setCvc(e.target.value)}
                placeholder="123"
                className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="cardholder-name" className="mb-2 block text-sm font-medium text-gray-800">
              Cardholder Name
            </label>
            <input
              id="cardholder-name"
              type="text"
              value={cardholderName}
              onChange={(e) => setCardholderName(e.target.value)}
              placeholder="John Doe"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div className="pt-2 space-y-4">
            {user ? (
              <>
                <button
                  type="submit"
                  disabled={loading || loadingHistory}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-xl btn-primary py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading || loadingHistory ? (
                    'Processing…'
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.657 0-3 .895-3 2v2h6v-2c0-1.105-1.343-2-3-2zm6 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2a2 2 0 012-2V9a4 4 0 118 0v2a2 2 0 012 2zm-6-8a2 2 0 00-2 2v2h4V7a2 2 0 00-2-2z" />
                      </svg>
                      {hasExistingApplication
                        ? `Pay $${applicationFee} & Update Application`
                        : `Pay $${applicationFee} & Continue to Application`}
                    </>
                  )}
                </button>

                <Link
                  to="/matches?tab=applied"
                  className="inline-flex w-full items-center justify-center rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Link>
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
                  {hasExistingApplication
                    ? `Pay $${applicationFee} & Update Application`
                    : `Pay $${applicationFee} & Continue to Application`}
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
        </form>
      </div>
    </div>
  )
}
