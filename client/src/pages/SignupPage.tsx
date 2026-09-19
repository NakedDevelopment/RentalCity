import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { trackMetaEvent } from '../lib/metaPixel'

type Role = 'tenant' | 'landlord'

export function SignupPage() {
  const [role, setRole] = useState<Role | null>(null)
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
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const navigate = useNavigate()

  const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())

  const meetsPasswordRequirements = (value: string) =>
    value.length >= 6 &&
    /[A-Z]/.test(value) &&
    /\d/.test(value) &&
    /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(value)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!role) {
      setStep(1)
      return
    }
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
      setPasswordError('Password needs uppercase, numbers, and symbols.')
      return
    }
    if (password !== confirmPassword) {
      setConfirmPasswordError('Password don\'t match yet.')
      return
    }
    if (!agreeTerms) {
      setTermsError('Please accept the terms to continue.')
      return
    }

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
      },
    })
    setLoading(false)

    if (signUpError) {
      const msg = signUpError.message?.toLowerCase() ?? ''
      if (msg.includes('already registered') || msg.includes('already in use') || signUpError.message?.includes('User already registered')) {
        setEmailError('Email already in use - try signing in instead.')
      } else {
        setError(signUpError.message)
      }
      return
    }

    // Supabase can intentionally return a user-shaped response for an already
    // registered address. A new email signup includes at least one identity.
    if ((data?.user?.identities?.length ?? 0) > 0) {
      trackMetaEvent('CompleteRegistration', { content_name: role })
    }

    // Update profile role (trigger creates profile with default 'tenant')
    if (data?.user) {
      await supabase.from('profiles').update({ role }).eq('id', data.user.id)
    }

    // If already signed in (e.g. confirm email off), send to app / landlord wizard
    let session = data?.session
    if (!session && data?.user) {
      const { data: sessionData } = await supabase.auth.getSession()
      session = sessionData?.session ?? null
    }
    if (session) {
      if (role === 'landlord') {
        navigate('/onboarding/profile', { replace: true })
      } else {
        navigate('/rental-needs', { replace: true })
      }
      return
    }

    navigate('/signup/verify', {
      state: {
        email,
      },
    })
  }

  const canSubmit =
    role &&
    email &&
    password &&
    confirmPassword &&
    agreeTerms &&
    meetsPasswordRequirements(password) &&
    password === confirmPassword

  function EyeIcon({ open }: { open: boolean }) {
    return (
      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        {open ? (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
          />
        ) : (
          <>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </>
        )}
      </svg>
    )
  }

  const [step, setStep] = useState<1 | 2>(1)

  function chooseRole(nextRole: Role) {
    setRole(nextRole)
    setStep(2)
    setError(null)
  }

  if (step === 1) {
    return (
      <div className="signup-shell flex min-h-[calc(100dvh-72px)] flex-1 items-center justify-center px-4 py-10 sm:py-16">
        <main className="signup-enter w-full max-w-[500px]">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e1f4fb] text-[#1683ae] shadow-sm">
              <svg aria-hidden="true" className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M3 20h18M5 20V8l7-4 7 4v12M9 20v-5h6v5M8 10h.01M12 10h.01M16 10h.01" />
              </svg>
            </div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.18em] text-[#1683ae]">Welcome to Rental City</p>
            <h1 className="text-[2rem] font-semibold tracking-[-.04em] text-[#17324d] sm:text-[2.35rem]">How will you use Rental City?</h1>
            <p className="mx-auto mt-3 max-w-[380px] text-sm leading-6 text-[#627589]">Choose the path that best describes you. You can change this before creating your account.</p>
          </div>

          <div className="space-y-3">
            <button type="button" data-testid="button-role-landlord" onClick={() => chooseRole('landlord')} className="signup-option group flex w-full items-center gap-4 rounded-2xl border border-[#dce7f0] bg-white p-5 text-left shadow-[0_4px_16px_rgba(35,74,105,.05)] focus:outline-none focus:ring-2 focus:ring-[#2a9dcc] focus:ring-offset-2 sm:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eaf7fb] text-[#1683ae]">
                <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M3 20h18M5 20V8l7-4 7 4v12M9 20v-5h6v5M8 10h.01M12 10h.01M16 10h.01" /></svg>
              </span>
              <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-[#17324d]">Landlord</span><span className="mt-1 block text-sm leading-5 text-[#627589]">I&apos;m listing a property and want to find tenants.</span></span>
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#9bb0c0] transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 18 6-6-6-6" /></svg>
            </button>
            <button type="button" data-testid="button-role-tenant" onClick={() => chooseRole('tenant')} className="signup-option group flex w-full items-center gap-4 rounded-2xl border border-[#dce7f0] bg-white p-5 text-left shadow-[0_4px_16px_rgba(35,74,105,.05)] focus:outline-none focus:ring-2 focus:ring-[#2a9dcc] focus:ring-offset-2 sm:p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#eef1ff] text-[#5369c9]">
                <svg aria-hidden="true" className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.7" d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
              </span>
              <span className="min-w-0 flex-1"><span className="block text-base font-semibold text-[#17324d]">Tenant</span><span className="mt-1 block text-sm leading-5 text-[#627589]">I&apos;m looking for a place to rent.</span></span>
              <svg aria-hidden="true" className="h-5 w-5 shrink-0 text-[#9bb0c0] transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="m9 18 6-6-6-6" /></svg>
            </button>
          </div>
          <p className="mt-8 text-center text-sm text-[#627589]">Already have an account? <Link data-testid="link-signin-role" to="/login" className="font-semibold text-[#1683ae] hover:underline">Sign in</Link></p>
        </main>
      </div>
    )
  }

  return (
    <div className="signup-shell flex flex-1 items-center justify-center px-4 py-10 sm:py-14">
      <div className="signup-enter w-full max-w-[460px]">
        <div className="signup-card rounded-3xl border border-[#dce7f0] bg-white px-6 py-8 sm:px-9 sm:py-10">
          <button type="button" data-testid="button-change-role" onClick={() => setStep(1)} className="mb-6 flex items-center gap-2 text-sm font-medium text-[#627589] transition-colors hover:text-[#1683ae] focus:outline-none focus:ring-2 focus:ring-[#2a9dcc] focus:ring-offset-2">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 12H5m7 7-7-7 7-7" /></svg>
            Change role
          </button>
          <div className="mb-7 rounded-xl border border-[#c9e8f3] bg-[#f0faff] px-4 py-3">
            <p data-testid="text-selected-role" className="text-sm font-semibold text-[#176b8d]">Signing up as a {role === 'landlord' ? 'Landlord' : 'Tenant'}</p>
            <p className="mt-1 text-xs text-[#627589]">{role === 'landlord' ? 'You are ready to find the right tenants.' : 'You are ready to find your next home.'}</p>
          </div>
          <h1 className="mb-2 text-[2rem] font-semibold tracking-[-.04em] text-[#17324d]">Create your account</h1>
          <p className="mb-8 text-sm leading-6 text-[#627589]">
            {role === 'landlord' ? 'Start listing your property and connect with quality tenants.' : 'Tell us a little about yourself and find a place that fits.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="email" className="block text-sm text-gray-700">
                  Email address
                </label>
                {emailError ? <p className="text-xs text-red-500">{emailError}</p> : null}
              </div>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                  setEmail(e.target.value)
                  if (emailError) setEmailError(null)
                }}
                onBlur={() => {
                  if (email.trim() && !isValidEmail(email)) setEmailError('Please enter a valid email.')
                  else setEmailError(null)
                }}
                  placeholder="Enter your email address"
                  className={`w-full rounded-lg border px-4 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none ${
                    emailError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                />
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="password" className="block text-sm text-gray-700">
                  Password
                </label>
                {passwordError ? <p className="text-xs text-red-500">{passwordError}</p> : null}
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value)
                    if (passwordError && meetsPasswordRequirements(e.target.value)) setPasswordError(null)
                    else if (e.target.value && !meetsPasswordRequirements(e.target.value))
                      setPasswordError('Password needs uppercase, numbers, and symbols.')
                  }}
                  onBlur={() => {
                    if (password && !meetsPasswordRequirements(password))
                      setPasswordError('Password needs uppercase, numbers, and symbols.')
                    else setPasswordError(null)
                  }}
                  placeholder="Create a password"
                  className={`w-full rounded-lg border px-4 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none ${
                    passwordError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor="confirmPassword" className="block text-sm text-gray-700">
                  Confirm password
                </label>
                {confirmPasswordError ? <p className="text-xs text-red-500">{confirmPasswordError}</p> : null}
              </div>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value)
                    if (e.target.value && password !== e.target.value) setConfirmPasswordError('Password don\'t match yet.')
                    else setConfirmPasswordError(null)
                  }}
                  onBlur={() => {
                    if (confirmPassword && password !== confirmPassword) setConfirmPasswordError('Password don\'t match yet.')
                    else setConfirmPasswordError(null)
                  }}
                  placeholder="Confirm your password"
                  className={`w-full rounded-lg border px-4 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none ${
                    confirmPasswordError ? 'border-red-500' : 'border-gray-300'
                  }`}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => {
                  setAgreeTerms(e.target.checked)
                  if (termsError) setTermsError(null)
                }}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-300"
              />
              <label htmlFor="terms" className="text-sm leading-6 text-gray-600">
                I agree to the{' '}
                <Link to="/terms" className="text-gray-500 underline hover:text-gray-700">
                  Terms of Service
                </Link>{' '}
                and{' '}
                <Link to="/privacy" className="text-gray-500 underline hover:text-gray-700">
                  Privacy Policy
                </Link>
              </label>
            </div>
            {termsError && (
              <p className="pl-6 text-xs text-red-500">{termsError}</p>
            )}

            {error && (
              <p className="text-red-600 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white transition-colors disabled:cursor-not-allowed disabled:bg-primary disabled:opacity-100"
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>

            <p className="pt-2 text-center text-sm text-gray-600">
              Already have an account?
            </p>
            <p className="text-center text-sm">
              <Link to="/login" className="font-medium text-gray-900 hover:text-gray-700">
                Sign in
              </Link>
            </p>
          </form>
        </div>

        <p className="mx-auto mt-8 max-w-[420px] text-center text-sm leading-6 text-gray-500">
          By signing up, you&apos;ll be able to list properties, find compatible tenants, and manage
          applications all in one place.
        </p>
      </div>
    </div>
  )
}
