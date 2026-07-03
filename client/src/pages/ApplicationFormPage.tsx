import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

/**
 * ApplicationFormPage — tenant application submission with $50 screening fee.
 *
 * Route: /applications/apply?propertyId=<uuid>&propertyTitle=<string>
 *
 * Flow:
 *   1. Tenant reviews what's included in their application
 *   2. Tenant sees the $50 Application/Screening Fee disclosure
 *   3. On "Proceed to Payment", server creates a Stripe PaymentIntent
 *   4. PLACEHOLDER: Stripe Elements card form collects payment
 *      (requires @stripe/stripe-js + @stripe/react-stripe-js — add via npm)
 *   5. On payment success, POST /api/applications/submit with paymentIntentId
 *   6. Navigate to confirmation
 *
 * Until Stripe Elements is wired up, step 4 is replaced by a mock confirm
 * button that calls the submit endpoint with a placeholder paymentIntentId.
 * Set STRIPE_SECRET_KEY and install @stripe/react-stripe-js to activate real
 * card collection.
 */

export function ApplicationFormPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const propertyId = searchParams.get('propertyId') ?? ''
  const propertyTitle = searchParams.get('propertyTitle') ?? 'this property'

  const [message, setMessage] = useState('')
  const [step, setStep] = useState<'review' | 'payment' | 'submitting' | 'error'>('review')
  const [errorMsg, setErrorMsg] = useState('')

  // PLACEHOLDER: Replace with real Stripe clientSecret + Elements once
  // @stripe/react-stripe-js is installed and VITE_STRIPE_PUBLISHABLE_KEY is set.
  const [paymentClientSecret, setPaymentClientSecret] = useState<string | null>(null)

  const SCREENING_FEE_DISPLAY = '$50.00'

  async function handleProceedToPayment() {
    if (!propertyId) {
      setErrorMsg('Missing property ID. Please go back and try again.')
      setStep('error')
      return
    }

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''

      const res = await fetch('/api/payments/screening-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Server error (${res.status})`)
      }

      const data = await res.json() as { clientSecret: string; paymentIntentId: string }
      setPaymentClientSecret(data.clientSecret)
      setStep('payment')
    } catch (err) {
      setErrorMsg((err as Error).message)
      setStep('error')
    }
  }

  // PLACEHOLDER: This mock confirm is only for development/testing before
  // real Stripe Elements are wired up. In production, the card form collects
  // and confirms the PaymentIntent; on stripe.confirmPayment success, call
  // handleSubmitApplication with the confirmed paymentIntentId.
  async function handleMockConfirmPayment() {
    if (!paymentClientSecret) return
    // Extract paymentIntentId from clientSecret (format: pi_xxx_secret_yyy)
    const paymentIntentId = paymentClientSecret.split('_secret_')[0]
    await handleSubmitApplication(paymentIntentId)
  }

  async function handleSubmitApplication(paymentIntentId: string) {
    setStep('submitting')
    setErrorMsg('')

    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token ?? ''

      const res = await fetch('/api/applications/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ propertyId, paymentIntentId, message }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Server error (${res.status})`)
      }

      navigate('/matches?tab=applied&submitted=1')
    } catch (err) {
      setErrorMsg((err as Error).message)
      setStep('error')
    }
  }

  const TOTAL_STEPS = 2
  const currentStep = step === 'review' ? 1 : 2

  return (
    <div className="px-4 py-8">
      <div className="max-w-[640px]">
        {/* Progress */}
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-700">Step {currentStep} of {TOTAL_STEPS}</p>
            <p className="text-sm text-gray-500">{currentStep === 1 ? '50%' : '100%'} Complete</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-gray-900 transition-all"
              style={{ width: currentStep === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {/* Step 1 — Review */}
        {step === 'review' && (
          <>
            <div className="mb-7">
              <h1 className="mb-2 text-[2rem] font-semibold tracking-tight text-gray-900">
                Submit your application
              </h1>
              <p className="text-sm text-gray-600">
                We&apos;ll attach your saved profile, universal application, and lease preferences to{' '}
                <span className="font-medium text-gray-900">{propertyTitle}</span>.
                You can add an optional note to the landlord below.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 space-y-5">
              {/* What's included */}
              <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-700">
                <p className="font-medium text-gray-900">What&apos;s included</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
                  <li>Personal information from your profile</li>
                  <li>Lease preferences and questionnaire answers</li>
                  <li>Rental and employment history from your universal application</li>
                </ul>
                <p className="mt-3 text-xs text-gray-500">
                  To update any of these details, go to <span className="font-medium">My Profile</span> before
                  submitting this application.
                </p>
              </div>

              {/* Application/Screening Fee disclosure */}
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm">
                <div className="flex items-start gap-3">
                  <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="font-semibold text-amber-900">Application / Screening Fee Required</p>
                    <p className="mt-1 text-amber-800">
                      A non-refundable <span className="font-semibold">{SCREENING_FEE_DISPLAY}</span> fee is required to
                      submit your application. This covers the cost of your background and credit screening.
                    </p>
                  </div>
                </div>
              </div>

              {/* Optional message */}
              <div>
                <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-800">
                  Message to landlord (optional)
                </label>
                <textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={5}
                  placeholder="Introduce yourself, share why this home is a good fit, or add any details you want the landlord to know."
                  className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                />
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <Link
                  to="/matches"
                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Cancel
                </Link>
                <button
                  type="button"
                  onClick={handleProceedToPayment}
                  disabled={!propertyId || !user}
                  className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl btn-primary px-5 py-3 text-base font-medium text-white disabled:opacity-50"
                >
                  Proceed to Payment ({SCREENING_FEE_DISPLAY})
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}

        {/* Step 2 — Payment */}
        {step === 'payment' && (
          <>
            <div className="mb-7">
              <h1 className="mb-2 text-[2rem] font-semibold tracking-tight text-gray-900">
                Payment
              </h1>
              <p className="text-sm text-gray-600">
                Complete your {SCREENING_FEE_DISPLAY} Application/Screening Fee to submit your application.
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6 space-y-5">
              {/* Fee summary */}
              <div className="rounded-xl bg-gray-50 px-4 py-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">Application / Screening Fee</span>
                  <span className="font-semibold text-gray-900">{SCREENING_FEE_DISPLAY}</span>
                </div>
                <div className="mt-3 border-t border-gray-200 pt-3 flex items-center justify-between text-sm font-semibold">
                  <span className="text-gray-900">Total due today</span>
                  <span className="text-gray-900">{SCREENING_FEE_DISPLAY}</span>
                </div>
              </div>

              {/* PLACEHOLDER: Replace this section with Stripe Elements card form.
                  Steps to activate real card collection:
                  1. npm install @stripe/stripe-js @stripe/react-stripe-js
                  2. Add VITE_STRIPE_PUBLISHABLE_KEY to .env.local
                  3. Wrap this route in <Elements stripe={loadStripe(key)} options={{ clientSecret }} />
                  4. Replace the mock confirm button with <PaymentElement /> + stripe.confirmPayment()
                  5. On stripe.confirmPayment success, call handleSubmitApplication(paymentIntentId)
              */}
              <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 px-4 py-6 text-center">
                <p className="text-sm font-semibold text-amber-800">Card Payment — Coming Soon</p>
                <p className="mt-1 text-xs text-amber-700">
                  Stripe Elements integration is pending. Install @stripe/react-stripe-js and set
                  VITE_STRIPE_PUBLISHABLE_KEY to activate real card collection.
                </p>
                <p className="mt-2 text-xs text-amber-600 font-mono">
                  PLACEHOLDER: Stripe card form goes here
                </p>
              </div>

              {/* Mock confirm — remove once real Stripe Elements is active */}
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-xs text-orange-700">
                <strong>Dev only:</strong> "Confirm Payment" below bypasses real card collection for testing.
                This button must be removed before production launch.
              </div>

              <div className="flex items-center justify-between gap-4 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('review')}
                  className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleMockConfirmPayment}
                  className="inline-flex min-w-[200px] items-center justify-center gap-2 rounded-xl btn-primary px-5 py-3 text-base font-medium text-white"
                >
                  Confirm Payment (Dev)
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>

              <p className="text-center text-xs text-gray-400">
                Secure payment processed by Stripe. Non-refundable once submitted.
              </p>
            </div>
          </>
        )}

        {/* Submitting state */}
        {step === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <svg className="h-10 w-10 animate-spin text-gray-400" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            <p className="text-sm text-gray-600">Submitting your application…</p>
          </div>
        )}

        {/* Error state */}
        {step === 'error' && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center space-y-4">
            <svg className="h-10 w-10 text-red-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold text-red-800">Something went wrong</p>
            <p className="text-sm text-red-700">{errorMsg}</p>
            <button
              type="button"
              onClick={() => setStep('review')}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-5 py-2.5 text-sm font-medium text-red-700 hover:bg-red-100"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
