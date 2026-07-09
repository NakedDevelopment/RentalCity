import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

type Role = 'tenant' | 'landlord'

export function SignupPage() {
  // Landlord-first launch: tenant self-signup is temporarily hidden.
  const role: Role = 'landlord'
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

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
          <h1 className="mb-2 text-center text-[2rem] font-medium text-gray-900">Sign Up</h1>
          <p className="mb-8 text-center text-[0.95rem] text-gray-600">
            Create your landlord account and start finding quality tenants!
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
