import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import { deriveLandlordPreferences } from '../lib/landlordPreferences'
import { landlordQuestions } from '../lib/landlordQuestionnaire'
import { centsToMoneyInput, moneyInputToCents } from '../lib/propertyDraft'

// ─── Session-storage data shape written by the rental report page ─────────────

export interface ReportPrefill {
  streetAddress: string
  city: string
  state: string
  zipCode: string
  /** Stringified integer, e.g. "3" or "0" for studio */
  bedrooms: string
  /** Stringified float, e.g. "2" or "1.5" */
  bathrooms: string
  squareFootage: string
  propertyType: string
  estimatedRentCents: number
  estimatedRentLow: number
  estimatedRentHigh: number
  /** From RentCast property record — null if unknown */
  yearBuilt: number | null
  lotSize: number | null
}

export const REPORT_PREFILL_KEY = 'rc-report-prefill'

function readPrefillFromSession(): ReportPrefill | null {
  try {
    const raw = sessionStorage.getItem(REPORT_PREFILL_KEY)
    if (!raw) return null
    return JSON.parse(raw) as ReportPrefill
  } catch {
    return null
  }
}

/** Fallback for users arriving from the emailed report link.
 *  The report template encodes property data as URL search params. */
function readPrefillFromParams(search: string): ReportPrefill | null {
  const params = new URLSearchParams(search)
  const addr = params.get('addr') || ''
  if (!addr) return null

  // Parse "123 Main St, Austin, TX 78701" → components
  const parts = addr.split(',').map((s) => s.trim()).filter((s) => s && s !== 'USA')
  const street = parts[0] || addr
  const city = parts[1] || ''
  const stateZip = parts[2] || ''
  const stateMatch = stateZip.match(/^([A-Z]{2})(?:\s+(\d{5}))?/)
  const state = stateMatch?.[1] || ''
  const zip = stateMatch?.[2] || ''

  const rentDollars = parseFloat(params.get('rent') || '0')
  const lowDollars = parseFloat(params.get('low') || '0')
  const highDollars = parseFloat(params.get('high') || '0')

  const yearRaw = parseInt(params.get('year') || '0', 10)
  const lotRaw = parseFloat(params.get('lot') || '0')

  return {
    streetAddress: street,
    city,
    state,
    zipCode: zip,
    bedrooms: params.get('beds') || '',
    bathrooms: params.get('baths') || '',
    squareFootage: params.get('sqft') || '',
    propertyType: params.get('type') || '',
    estimatedRentCents: Math.round(rentDollars * 100),
    estimatedRentLow: Math.round(lowDollars * 100),
    estimatedRentHigh: Math.round(highDollars * 100),
    yearBuilt: yearRaw > 0 ? yearRaw : null,
    lotSize: lotRaw > 0 ? lotRaw : null,
  }
}

/** Auto-generates a listing description from prefill data.
 *  Only used as a default — the landlord can edit it freely. */
function generateDescription(p: ReportPrefill): string {
  const beds = parseInt(p.bedrooms || '0', 10)
  const baths = parseFloat(p.bathrooms || '0')
  const sqftNum = parseInt(p.squareFootage || '0', 10)
  const type = p.propertyType || 'property'

  const bedsStr = beds === 0 ? 'Studio' : `${beds}-bedroom`
  const bathsStr = baths > 0 ? `, ${baths}-bathroom` : ''
  const sqftStr = sqftNum > 0 ? ` with ${sqftNum.toLocaleString()} sq ft of living space` : ''
  const yearStr = p.yearBuilt ? `, built in ${p.yearBuilt}` : ''

  const lines: string[] = []
  lines.push(`${bedsStr}${bathsStr} ${type}${sqftStr}${yearStr}.`)
  if (p.lotSize && p.lotSize > 0) {
    lines.push(`Sits on a ${Math.round(p.lotSize).toLocaleString()} sq ft lot.`)
  }
  if (p.city && p.state) {
    lines.push(`Conveniently located in ${p.city}, ${p.state}.`)
  }
  return lines.join(' ')
}

// ─── Inline signup modal ──────────────────────────────────────────────────────

interface SignupModalProps {
  onSignedIn: (userId: string) => void
  onWantsLogin: () => void
}

const meetsPasswordRequirements = (v: string) =>
  v.length >= 6 &&
  /[A-Z]/.test(v) &&
  /\d/.test(v) &&
  /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(v)

function SignupModal({ onSignedIn, onWantsLogin }: SignupModalProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null)
  const [termsError, setTermsError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setEmailError(null)
    setPasswordError(null)
    setConfirmPasswordError(null)
    setTermsError(null)

    if (!isValidEmail(email)) {
      setEmailError('Please enter a valid email.')
      return
    }
    if (!meetsPasswordRequirements(password)) {
      setPasswordError('Password needs uppercase, a number, and a symbol.')
      return
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError("Passwords don't match yet.")
      return
    }
    if (!agreeTerms) {
      setTermsError('Please accept the terms to continue.')
      return
    }

    setLoading(true)

    // Try sign-in first (returning user who forgot they have an account).
    const { data: siData } = await supabase.auth.signInWithPassword({ email, password })
    if (siData.user && siData.session) {
      setLoading(false)
      onSignedIn(siData.user.id)
      return
    }

    // Create new account.
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { role: 'landlord' } },
    })
    if (signUpError) {
      const msg = signUpError.message?.toLowerCase() ?? ''
      if (msg.includes('already registered') || msg.includes('already in use')) {
        setEmailError('Email already in use — try signing in instead.')
      } else {
        setError(signUpError.message)
      }
      setLoading(false)
      return
    }

    if (!data.user) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    if (!data.session) {
      // Email confirmation required — user cannot proceed until confirmed.
      setNeedsConfirmation(true)
      setLoading(false)
      return
    }

    // Set landlord role in profiles table.
    await supabase.from('profiles').upsert({ id: data.user.id, role: 'landlord' }, { onConflict: 'id' })

    setLoading(false)
    onSignedIn(data.user.id)
  }

  if (needsConfirmation) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-green-50">
            <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Check your email</h2>
          <p className="mt-2 text-sm text-gray-500">
            We sent a confirmation link to <strong>{email}</strong>. Click it, then come back and log in to complete your listing.
          </p>
          <button
            type="button"
            onClick={onWantsLogin}
            className="mt-6 w-full rounded-lg btn-primary py-3 text-sm font-medium text-white"
          >
            I've confirmed — sign me in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-gray-900">
            <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Save your listing</h2>
          <p className="mt-1 text-sm text-gray-500">Create a free account to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setEmailError(null) }}
              placeholder="you@example.com"
              autoFocus
              className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ${emailError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-gray-400'}`}
              required
            />
            {emailError && <p className="mt-1 text-xs text-red-600">{emailError}</p>}
          </div>

          {/* Password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setPasswordError(null) }}
              placeholder="Uppercase, number, and symbol"
              className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ${passwordError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-gray-400'}`}
              required
            />
            {passwordError && <p className="mt-1 text-xs text-red-600">{passwordError}</p>}
          </div>

          {/* Confirm password */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Confirm password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); setConfirmPasswordError(null) }}
              placeholder="Confirm your password"
              className={`w-full rounded-lg border px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:outline-none ${confirmPasswordError ? 'border-red-400 focus:border-red-400' : 'border-gray-200 focus:border-gray-400'}`}
              required
            />
            {confirmPasswordError && <p className="mt-1 text-xs text-red-600">{confirmPasswordError}</p>}
          </div>

          {/* Terms + privacy */}
          <div className="flex items-start gap-3">
            <input
              id="modal-terms"
              type="checkbox"
              checked={agreeTerms}
              onChange={(e) => { setAgreeTerms(e.target.checked); setTermsError(null) }}
              className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
            />
            <label htmlFor="modal-terms" className="text-sm leading-6 text-gray-600">
              I agree to the{' '}
              <Link to="/terms" target="_blank" className="text-gray-500 underline hover:text-gray-700">
                Terms of Service
              </Link>{' '}
              and{' '}
              <Link to="/privacy" target="_blank" className="text-gray-500 underline hover:text-gray-700">
                Privacy Policy
              </Link>
            </label>
          </div>
          {termsError && <p className="pl-7 text-xs text-red-500">{termsError}</p>}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? 'Creating account…' : 'Create account & save listing'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-gray-500">
          Already have an account?{' '}
          <button type="button" onClick={onWantsLogin} className="underline hover:text-gray-700">
            Sign in instead
          </button>
        </p>
      </div>
    </div>
  )
}

// ─── Survey popover ────────────────────────────────────────────────────────────

interface SurveyPopoverProps {
  userId: string
  onComplete: () => void
  onSkip: () => void
}

function SurveyPopover({ userId, onComplete, onSkip }: SurveyPopoverProps) {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const totalQuestions = landlordQuestions.length
  const currentQuestion = landlordQuestions[step - 1]
  const isMulti = currentQuestion?.type === 'multi'
  const selectedAnswer = answers[currentQuestion?.id ?? '']
  const progressPercent = Math.round((step / totalQuestions) * 100)

  const canProceed = currentQuestion
    ? isMulti
      ? Array.isArray(selectedAnswer) && selectedAnswer.length > 0
      : !!selectedAnswer && typeof selectedAnswer === 'string'
    : false

  function handleSelect(choiceId: string) {
    if (!currentQuestion) return
    const qid = currentQuestion.id
    if (currentQuestion.type === 'single') {
      setAnswers((prev) => ({ ...prev, [qid]: choiceId }))
    } else {
      const exclusiveIds = new Set(currentQuestion.choices.filter((c) => c.exclusive).map((c) => c.id))
      const arr = Array.isArray(answers[qid]) ? (answers[qid] as string[]) : []
      let next: string[]
      if (arr.includes(choiceId)) {
        next = arr.filter((c) => c !== choiceId)
      } else if (exclusiveIds.has(choiceId)) {
        next = [choiceId]
      } else {
        next = [...arr.filter((c) => !exclusiveIds.has(c)), choiceId]
      }
      setAnswers((prev) => ({ ...prev, [qid]: next }))
    }
  }

  async function handleComplete() {
    setSaving(true)
    setError(null)
    const prefs = deriveLandlordPreferences(answers as Record<string, string | string[] | null | undefined>)
    const { error: qErr } = await supabase.from('landlord_questionnaire').upsert(
      {
        user_id: userId,
        answers,
        policy_strictness_score: prefs.policyStrictnessScore,
        risk_tolerance_score: prefs.riskToleranceScore,
        conflict_style_score: prefs.conflictStyleScore,
      },
      { onConflict: 'user_id' },
    )
    if (qErr) {
      setError('Could not save answers. Please try again.')
      setSaving(false)
      return
    }
    await supabase
      .from('profiles')
      .update({ landlord_survey_completed_at: new Date().toISOString() })
      .eq('id', userId)
    setSaving(false)
    onComplete()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="border-b border-gray-100 px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Help us find your perfect tenants</h2>
              <p className="mt-0.5 text-sm text-gray-500">{totalQuestions} quick questions to improve your matches</p>
            </div>
            <button type="button" onClick={onSkip} className="shrink-0 text-sm text-gray-400 underline hover:text-gray-600">
              Skip for now
            </button>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-gray-500">
              <span>Question {step} of {totalQuestions}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-200">
              <div
                className="h-1.5 rounded-full bg-gray-900 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>

        {/* Question */}
        <div className="px-6 py-6">
          <h3 className="text-base font-medium text-gray-900">{currentQuestion?.text}</h3>
          {currentQuestion?.helperText && (
            <p className="mt-1.5 text-sm text-gray-500">{currentQuestion.helperText}</p>
          )}
          <div className="mt-5 space-y-2.5">
            {currentQuestion?.choices.map((choice) => {
              const selected = isMulti
                ? Array.isArray(selectedAnswer) && selectedAnswer.includes(choice.id)
                : selectedAnswer === choice.id
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleSelect(choice.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-4 text-left text-sm transition-colors ${
                    selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                      isMulti ? 'rounded' : 'rounded-full'
                    } ${selected ? 'border-gray-900 bg-gray-900' : 'border-gray-400 bg-white'}`}
                  >
                    {selected &&
                      (isMulti ? (
                        <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      ))}
                  </span>
                  <span className="text-gray-800">{choice.label}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : onSkip())}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {step > 1 ? 'Back' : 'Skip'}
          </button>

          {step < totalQuestions ? (
            <button
              type="button"
              onClick={() => canProceed && setStep((s) => s + 1)}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Next
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={!canProceed || saving}
              className="inline-flex items-center gap-2 rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Complete'}
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
        {error && <p className="px-6 pb-4 text-sm text-red-600">{error}</p>}
      </div>
    </div>
  )
}

// ─── Property preview card (live, driven by form state) ──────────────────────

interface PreviewCardProps {
  streetAddress: string
  city: string
  state: string
  beds: string
  baths: string
  sqft: string
  monthlyRent: string
  description: string
  estimatedRentCents: number
  estimatedRentLow: number
  estimatedRentHigh: number
}

function fmt$(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

function PreviewCard({
  streetAddress,
  city,
  state,
  beds,
  baths,
  sqft,
  monthlyRent,
  description,
  estimatedRentCents,
  estimatedRentLow,
  estimatedRentHigh,
}: PreviewCardProps) {
  const rentCents = moneyInputToCents(monthlyRent)
  const formattedRent = rentCents > 0 ? fmt$(rentCents) : '—'
  const bedLabel = beds === '0' ? 'Studio' : beds ? `${beds} bed` : '—'
  const bathLabel = baths ? `${baths} bath` : '—'
  const sqftNum = parseInt(sqft || '0', 10)

  const showEstimate = estimatedRentCents > 0

  return (
    <div className="sticky top-6 rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Photo placeholder */}
      <div className="relative h-44 bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center gap-1">
        <svg className="h-7 w-7 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-xs text-slate-400">Photos can be added after signup</p>
        <span className="absolute right-3 top-3 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Draft</span>
      </div>

      <div className="p-5">
        {/* Rent + address */}
        <div>
          <p className="text-2xl font-bold text-gray-900">
            {formattedRent}
            <span className="text-sm font-normal text-gray-500">/mo</span>
          </p>
          {streetAddress && <p className="mt-1 text-sm font-medium text-gray-700">{streetAddress}</p>}
          {(city || state) && (
            <p className="text-sm text-gray-500">{[city, state].filter(Boolean).join(', ')}</p>
          )}
        </div>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-gray-600">
          {beds && <span className="flex items-center gap-1">
            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
            {bedLabel}
          </span>}
          {baths && <span>{bathLabel}</span>}
          {sqftNum > 0 && <span>{sqftNum.toLocaleString()} sq ft</span>}
        </div>

        {/* Description preview */}
        {description && (
          <p className="mt-3 text-sm leading-6 text-gray-600 line-clamp-3">{description}</p>
        )}

        {/* Estimate strip */}
        {showEstimate && (
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-3.5 py-3">
            <p className="text-xs font-medium text-blue-700">RentCast estimate</p>
            <p className="mt-0.5 text-sm font-semibold text-blue-900">{fmt$(estimatedRentCents)}/mo</p>
            {estimatedRentLow > 0 && estimatedRentHigh > 0 && (
              <p className="text-xs text-blue-600">Range: {fmt$(estimatedRentLow)} – {fmt$(estimatedRentHigh)}</p>
            )}
          </div>
        )}

        <div className="mt-4 rounded-lg bg-gray-50 px-3 py-2.5 text-xs text-gray-500">
          This preview updates as you fill out the form. Add photos after creating your account to publish.
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

export function ListFromReportPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  // Report prefill data
  const [prefill, setPrefill] = useState<ReportPrefill | null>(null)
  const [prefillMissing, setPrefillMissing] = useState(false)

  // Form state
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [beds, setBeds] = useState('')
  const [baths, setBaths] = useState('')
  const [sqft, setSqft] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [description, setDescription] = useState('')
  const [leaseTerm, setLeaseTerm] = useState('')
  const [deposit, setDeposit] = useState('')

  // UI state
  const [showSignupModal, setShowSignupModal] = useState(false)
  const [showSurveyPopover, setShowSurveyPopover] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [, setSavedPropertyId] = useState<string | null>(null)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  // Ref guard — prevents double-save if the button is clicked twice quickly
  const savingRef = useRef(false)

  // Load prefill: sessionStorage first (user came from report tool on same tab),
  // then URL params (user clicked a link in the emailed report).
  useEffect(() => {
    const data = readPrefillFromSession() ?? readPrefillFromParams(searchParams.toString())
    if (!data) {
      setPrefillMissing(true)
      return
    }
    setPrefill(data)
    setStreetAddress(data.streetAddress)
    setCity(data.city)
    setState(data.state)
    setZipCode(data.zipCode)
    setBeds(data.bedrooms)
    setBaths(data.bathrooms)
    setSqft(data.squareFootage)
    setMonthlyRent(centsToMoneyInput(data.estimatedRentCents))
    // Auto-generate a description from available property data (editable by landlord)
    const autoDesc = generateDescription(data)
    if (autoDesc) setDescription(autoDesc)
  }, [searchParams])

  // If already logged in, set activeUserId
  useEffect(() => {
    if (user) setActiveUserId(user.id)
  }, [user])

  async function persistProperty(userId: string): Promise<string | null> {
    // Guard against double-submit (e.g. rapid double-click or React StrictMode double-effect)
    if (savingRef.current) return null
    savingRef.current = true
    setSaving(true)
    setSaveError(null)

    const rentCents = moneyInputToCents(monthlyRent)
    const depositCents = deposit.trim() ? moneyInputToCents(deposit) : rentCents
    const bedroomCount = beds === '0' || beds === 'studio' ? 0 : parseInt(beds || '0', 10)
    const bathroomCount = parseFloat(baths || '0')

    if (!streetAddress || !city || !state || !monthlyRent) {
      setSaveError('Please fill in the address and monthly rent before saving.')
      setSaving(false)
      savingRef.current = false
      return null
    }

    const { data, error } = await supabase
      .from('properties')
      .insert({
        landlord_id: userId,
        title: (() => {
          const b = parseInt(beds || '0', 10)
          const bStr = b === 0 ? 'Studio' : `${b}BR`
          const ba = parseFloat(baths || '0')
          const baStr = ba > 0 ? `/${ba}BA` : ''
          return city ? `${bStr}${baStr} in ${city}${state ? ', ' + state : ''}` : null
        })(),
        address_line1: streetAddress,
        city,
        state,
        postal_code: zipCode || null,
        bedrooms: isNaN(bedroomCount) ? 0 : bedroomCount,
        bathrooms: isNaN(bathroomCount) ? 0 : bathroomCount,
        monthly_rent_cents: rentCents,
        deposit_cents: depositCents,
        application_fee_cents: 5000,
        description: description || null,
        lease_term: leaseTerm ? `${leaseTerm} months` : null,
        amenities: [],
        photo_labels: [],
        photo_urls: [],
        status: 'draft',
      })
      .select('id')
      .single()

    setSaving(false)
    savingRef.current = false

    if (error) {
      if (error.code === '42501' || /row-level security/i.test(error.message)) {
        setSaveError("Your landlord membership isn't active yet. Please contact support.")
      } else {
        setSaveError('Could not save your property. Please try again.')
      }
      return null
    }

    return (data as { id: string }).id
  }

  async function handleSaveClick() {
    if (activeUserId || user) {
      const uid = activeUserId ?? user!.id
      const id = await persistProperty(uid)
      if (id) {
        setSavedPropertyId(id)
        setShowSurveyPopover(true)
      }
    } else {
      setShowSignupModal(true)
    }
  }

  async function handleSignedIn(userId: string) {
    setActiveUserId(userId)
    setShowSignupModal(false)
    const id = await persistProperty(userId)
    if (id) {
      setSavedPropertyId(id)
      setShowSurveyPopover(true)
    }
  }

  function handleWantsLogin() {
    setShowSignupModal(false)
    navigate('/login')
  }

  function handleSurveyDone() {
    setShowSurveyPopover(false)
    // Navigate to properties list so they can see their draft and add photos
    navigate('/properties')
  }

  function handleSurveySkip() {
    setShowSurveyPopover(false)
    navigate('/properties')
  }

  if (prefillMissing) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
        <svg className="mx-auto mb-4 h-10 w-10 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <h1 className="text-xl font-semibold text-gray-900">Start with a rental estimate</h1>
        <p className="mt-2 text-sm text-gray-500">
          Use our free rental value tool first, then list your property in one click.
        </p>
        <a
          href="/rental-value-report/"
          className="mt-6 inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-3 text-sm font-medium text-white"
        >
          Get my rental estimate
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </a>
      </div>
    )
  }

  if (!prefill) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="text-sm text-gray-400">Loading…</span>
      </div>
    )
  }

  return (
    <>
      {/* Modals */}
      {showSignupModal && (
        <SignupModal onSignedIn={handleSignedIn} onWantsLogin={handleWantsLogin} />
      )}
      {showSurveyPopover && (activeUserId ?? user?.id) && (
        <SurveyPopover
          userId={activeUserId ?? user!.id}
          onComplete={handleSurveyDone}
          onSkip={handleSurveySkip}
        />
      )}

      <div className="min-h-full px-4 py-10">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-8">
            <a
              href="/rental-value-report/"
              className="mb-4 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to report
            </a>
            <h1 className="text-3xl font-semibold text-gray-900">List your property</h1>
            <p className="mt-2 text-sm text-gray-500">
              We've pre-filled the details from your report. Review and adjust, then save to find your perfect tenants.
            </p>
          </div>

          {/* Two-column layout */}
          <div className="grid gap-8 lg:grid-cols-5">
            {/* Form — wider column */}
            <div className="lg:col-span-3 space-y-6">
              {/* Address card */}
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Property address</h2>
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Street address *</label>
                    <input
                      type="text"
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="123 Main Street"
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">City *</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Austin"
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">State *</label>
                      <div className="relative">
                        <select
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                        >
                          <option value="">—</option>
                          {US_STATES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">ZIP</label>
                      <input
                        type="text"
                        value={zipCode}
                        onChange={(e) => setZipCode(e.target.value)}
                        placeholder="78701"
                        className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Property details card */}
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Property details</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Bedrooms</label>
                    <div className="relative">
                      <select
                        value={beds}
                        onChange={(e) => setBeds(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                      >
                        <option value="">—</option>
                        <option value="0">Studio</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                        <option value="5">5+</option>
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Bathrooms</label>
                    <div className="relative">
                      <select
                        value={baths}
                        onChange={(e) => setBaths(e.target.value)}
                        className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                      >
                        <option value="">—</option>
                        <option value="1">1</option>
                        <option value="1.5">1.5</option>
                        <option value="2">2</option>
                        <option value="2.5">2.5</option>
                        <option value="3">3</option>
                        <option value="3.5">3.5+</option>
                      </select>
                      <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Sq ft</label>
                    <input
                      type="text"
                      value={sqft}
                      onChange={(e) => setSqft(e.target.value.replace(/\D/g, ''))}
                      placeholder="1,200"
                      className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Rent & terms card */}
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">Rent & terms</h2>
                {prefill.estimatedRentCents > 0 && (
                  <p className="mt-1 text-xs text-blue-600">
                    RentCast estimate: {fmt$(prefill.estimatedRentCents)}/mo
                    {prefill.estimatedRentLow > 0 && prefill.estimatedRentHigh > 0
                      ? ` (range: ${fmt$(prefill.estimatedRentLow)} – ${fmt$(prefill.estimatedRentHigh)})`
                      : ''}
                  </p>
                )}
                <div className="mt-4 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Monthly rent *</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                      <input
                        type="text"
                        value={monthlyRent}
                        onChange={(e) => setMonthlyRent(e.target.value)}
                        placeholder="2,500"
                        className="w-full rounded-lg border border-gray-200 py-3 pl-8 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                      />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Security deposit <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                        <input
                          type="text"
                          value={deposit}
                          onChange={(e) => setDeposit(e.target.value)}
                          placeholder="Defaults to 1 month"
                          className="w-full rounded-lg border border-gray-200 py-3 pl-8 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1.5 block text-sm font-medium text-gray-700">
                        Lease term <span className="font-normal text-gray-400">(optional)</span>
                      </label>
                      <div className="relative">
                        <select
                          value={leaseTerm}
                          onChange={(e) => setLeaseTerm(e.target.value)}
                          className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-8 text-sm text-gray-700 focus:border-gray-400 focus:outline-none"
                        >
                          <option value="">Select</option>
                          <option value="6">6 months</option>
                          <option value="12">12 months</option>
                          <option value="18">18 months</option>
                          <option value="24">24 months</option>
                        </select>
                        <svg className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description card */}
              <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
                <h2 className="text-base font-semibold text-gray-900">
                  Description <span className="text-sm font-normal text-gray-400">(optional)</span>
                </h2>
                <p className="mt-1 text-xs text-gray-500">Tell prospective tenants what makes this property great.</p>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Bright, spacious 3-bedroom home in a quiet neighborhood, walking distance to schools and parks…"
                  rows={4}
                  className="mt-3 w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none resize-none"
                />
              </div>

              {/* Save button */}
              <div>
                {saveError && <p className="mb-3 text-sm text-red-600">{saveError}</p>}
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleSaveClick}
                  className="w-full rounded-xl btn-primary py-4 text-base font-semibold text-white disabled:opacity-60"
                >
                  {saving
                    ? 'Saving…'
                    : user || activeUserId
                    ? 'Save property'
                    : 'Save property — create free account'}
                </button>
                <p className="mt-2 text-center text-xs text-gray-400">
                  Saved as a draft. You'll add photos and publish after signing up.
                </p>
              </div>
            </div>

            {/* Preview — narrower column */}
            <div className="lg:col-span-2">
              <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">Live preview</p>
              <PreviewCard
                streetAddress={streetAddress}
                city={city}
                state={state}
                beds={beds}
                baths={baths}
                sqft={sqft}
                monthlyRent={monthlyRent}
                description={description}
                estimatedRentCents={prefill.estimatedRentCents}
                estimatedRentLow={prefill.estimatedRentLow}
                estimatedRentHigh={prefill.estimatedRentHigh}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
