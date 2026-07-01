import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import StripeCheckoutModal from '../components/StripeCheckoutModal'
import { stripeConfigured } from '../lib/stripe'

const ANNUAL_MEMBERSHIP_FEE = 350

function StepHeader() {
  const steps = [
    { number: 1, label: 'Account Created', complete: true, active: false },
    { number: 2, label: 'Profile Setup', complete: true, active: false },
    { number: 3, label: 'Landlord Survey', complete: true, active: false },
    { number: 4, label: 'Add Property', complete: false, active: true },
  ]
  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
        {steps.map((step, index) => (
          <div key={step.label} className="flex min-w-0 flex-1 items-center">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                  step.complete || step.active ? 'gradient-primary text-white' : 'bg-gray-200 text-gray-500'
                }`}
              >
                {step.complete ? (
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  step.number
                )}
              </span>
              <span className={`text-sm ${step.active || step.complete ? 'text-gray-900' : 'text-gray-500'}`}>
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 ? <div className="mx-4 h-px flex-1 bg-gray-200" /> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

export function AddPropertyIntroPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [isMember, setIsMember] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [canceled, setCanceled] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    async function run() {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const accessToken = sess.session?.access_token
        if (!accessToken) {
          if (alive) {
            setError('Your session expired. Please sign in again.')
            setLoading(false)
          }
          return
        }
        const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }

        const membershipParam = searchParams.get('membership')
        const sessionId = searchParams.get('session_id')

        if (membershipParam === 'success' && sessionId) {
          setConfirming(true)
          const res = await fetch('/api/stripe/landlord/membership/confirm', {
            method: 'POST',
            headers,
            body: JSON.stringify({ sessionId }),
          })
          if (!res.ok) {
            const err = await res.json().catch(() => ({}))
            throw new Error((err as { error?: string }).error || 'We could not confirm your membership.')
          }
          const json = (await res.json()) as { active?: boolean }
          if (!alive) return
          setIsMember(Boolean(json.active))
          setConfirming(false)
          setLoading(false)
          navigate('/onboarding/property/intro', { replace: true })
          return
        }

        if (membershipParam === 'cancel' && alive) setCanceled(true)

        const res = await fetch('/api/stripe/landlord/membership', { headers })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || 'Could not check your membership.')
        }
        const json = (await res.json()) as { active?: boolean }
        if (!alive) return
        setIsMember(Boolean(json.active))
        setLoading(false)
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Something went wrong.')
          setConfirming(false)
          setLoading(false)
        }
      }
    }
    run()
    return () => {
      alive = false
    }
  }, [searchParams, navigate])

  function handleSubscribe() {
    setError(null)
    setCanceled(false)
    if (!user) {
      setError('Your session expired. Please sign in again.')
      return
    }
    if (!stripeConfigured) {
      setError('Payments are not configured yet. Please try again later.')
      return
    }
    setCheckoutOpen(true)
  }

  const fetchClientSecret = useCallback(async () => {
    const { data: sess } = await supabase.auth.getSession()
    const accessToken = sess.session?.access_token
    if (!accessToken) throw new Error('Your session expired. Please sign in again.')
    const res = await fetch('/api/stripe/landlord/membership/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({}),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || 'Could not start checkout. Please try again.')
    }
    const json = (await res.json()) as { clientSecret?: string }
    if (!json.clientSecret) throw new Error('Could not start checkout. Please try again.')
    return json.clientSecret
  }, [])

  if (loading || confirming) {
    return (
      <div className="min-h-full">
        <StepHeader />
        <div className="px-4 py-20 text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
          <p className="text-sm text-gray-600">{confirming ? 'Activating your membership…' : 'Loading…'}</p>
        </div>
      </div>
    )
  }

  if (!isMember) {
    const membershipBenefits = [
      'List unlimited properties for a full year',
      'Get matched with pre-screened, qualified renters',
      'Access tenant applications and shareable links',
      'Renews automatically each year — cancel anytime',
    ]
    return (
      <div className="min-h-full">
        <StepHeader />
        <div className="px-4 py-12">
          <div className="mx-auto max-w-[544px] rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center shadow-sm">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-700">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>

            <h1 className="text-[2rem] font-medium text-gray-900">Activate Your Membership</h1>
            <p className="mx-auto mt-4 max-w-[420px] text-base leading-8 text-gray-600">
              To list properties on Rental City, activate your annual landlord membership. This is required before you
              can publish your first listing.
            </p>

            <div className="mx-auto mt-7 max-w-[360px] rounded-xl bg-gray-50 px-6 py-6">
              <div className="flex items-baseline justify-center gap-2 text-gray-900">
                <span className="text-4xl font-semibold">${ANNUAL_MEMBERSHIP_FEE}</span>
                <span className="text-lg text-gray-600">/year</span>
              </div>
              <p className="mt-2 text-sm text-gray-500">Auto-renewing annual membership</p>
            </div>

            <ul className="mx-auto mt-7 max-w-[360px] space-y-3 text-left">
              {membershipBenefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-gray-700">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>

            {error ? (
              <div className="mt-6 rounded-xl bg-red-50 px-4 py-3 text-center text-sm text-red-800">{error}</div>
            ) : null}
            {canceled && !error ? (
              <div className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-center text-sm text-amber-800">
                Membership checkout canceled. You can activate whenever you&apos;re ready.
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSubscribe}
              className="mt-8 inline-flex items-center gap-2 rounded-lg btn-primary px-8 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {`Activate Membership — $${ANNUAL_MEMBERSHIP_FEE}/year`}
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Secure payment processed by Stripe
            </div>
          </div>
        </div>

        <StripeCheckoutModal
          open={checkoutOpen}
          onClose={() => setCheckoutOpen(false)}
          fetchClientSecret={fetchClientSecret}
          title="Activate your membership"
        />
      </div>
    )
  }

  const processSteps = [
    { number: 1, title: 'Basic Details', description: 'Add address, rent amount, and property type in under 2 minutes' },
    { number: 2, title: 'Upload Photos', description: "Add 5+ photos to showcase your property's best features" },
    { number: 3, title: 'Amenities & Description', description: 'Select amenities and write a brief description to attract tenants' },
  ]

  const benefits = [
    'Takes only 5-10 minutes',
    'Start receiving tenant matches',
    'Get shareable application link',
    'Quality tenant screening',
  ]

  return (
    <div className="min-h-full">
      <StepHeader />

      <div className="px-4 py-12">
        <div className="mx-auto max-w-[544px] rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-700">
            <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 1.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 10h1v6a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
            </svg>
          </div>

          <h1 className="text-[2rem] font-medium text-gray-900">Add Your First Property</h1>
          <p className="mx-auto mt-4 max-w-[420px] text-base leading-8 text-gray-600">
            Get your property listed and start receiving quality tenant matches in just a few minutes.
          </p>

          <h2 className="mt-8 text-[1.55rem] font-medium text-gray-900">Quick &amp; Simple Process</h2>

          <div className="mx-auto mt-7 max-w-[350px] space-y-6 text-left">
            {processSteps.map((item) => (
              <div key={item.number} className="flex items-start gap-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-medium text-white">
                  {item.number}
                </span>
                <div>
                  <h3 className="text-[1.1rem] font-medium text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-5 py-4 text-left">
            <h3 className="text-center text-[1.15rem] font-medium text-gray-900">Why Add Your Property Now?</h3>
            <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {benefits.map((benefit, index) => (
                <div key={benefit} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {index === 0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    ) : index === 1 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
                    ) : index === 2 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-1.414 1.414a4 4 0 01-5.657-5.657l1.414-1.414m5.657-1.414a4 4 0 00-5.657 0L7.757 8.17" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0-1.657 1.343-3 3-3h1V7a4 4 0 10-8 0v1h1c1.657 0 3 1.343 3 3v2m-7 8h14a2 2 0 002-2v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2z" />
                    )}
                  </svg>
                  {benefit}
                </div>
              ))}
            </div>
          </div>

          <Link
            to="/onboarding/property/basic-info"
            className="mt-8 inline-flex items-center gap-2 rounded-lg btn-primary px-8 py-3 text-sm font-medium text-white"
          >
            Add Property
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>

          <p className="mt-5 text-sm text-gray-500">You can save your progress and continue later.</p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Your property will be visible to matched tenants only after completion
        </div>
      </div>
    </div>
  )
}
