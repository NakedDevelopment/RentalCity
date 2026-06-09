import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { fetchSiteSettingsMerged } from '../lib/siteSettings'
import { supabase } from '../lib/supabase'

type LocationState = {
  email?: string
}

export function VerifyEmailPage() {
  const location = useLocation()
  const state = (location.state as LocationState | null) ?? null
  const email = state?.email ?? 'email@email.com'
  const [resending, setResending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [supportEmail, setSupportEmail] = useState('support@rentalcity.com')

  useEffect(() => {
    let cancelled = false
    fetchSiteSettingsMerged(supabase)
      .then((settings) => {
        if (!cancelled) setSupportEmail(settings.support_contact_email)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  async function handleResend() {
    setMessage(null)
    setResending(true)

    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    })

    setResending(false)

    if (error) {
      setMessage(error.message)
      return
    }

    setMessage('Verification email resent. Please check your inbox.')
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[322px]">
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-7 shadow-sm">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-white">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8m-2 10H5a2 2 0 01-2-2V8a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 10l1.5 1.5L21 8" />
              </svg>
            </div>
          </div>

          <h1 className="mb-2 text-center text-[2rem] font-medium text-gray-900">Check Your Email</h1>
          <p className="mb-6 text-center text-sm text-gray-600">We&apos;ve sent you a verification link</p>

          <div className="rounded-xl bg-gray-50 px-4 py-5 text-center">
            <p className="mb-4 text-sm text-gray-700">
              Thanks for signing up! We&apos;ve sent an email to
            </p>
            <div className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-900">
              {email}
            </div>
            <p className="mt-4 text-sm leading-7 text-gray-600">
              Please click the link in your email to verify your email address and continue with your application.
            </p>
          </div>

          <div className="mt-6 space-y-3">
            <a
              href={`mailto:${email}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-3 text-center text-sm font-medium text-white"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.94 5.5A2 2 0 014.75 4.5h10.5a2 2 0 011.81 1L10 9.94 2.94 5.5z" />
                <path d="M2 7.1v6.15a2 2 0 002 2h12a2 2 0 002-2V7.1l-7.42 4.65a1 1 0 01-1.06 0L2 7.1z" />
              </svg>
              Open Email App
            </a>

            <button
              type="button"
              onClick={handleResend}
              disabled={resending}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582M20 20v-5h-.581M5.8 15A7 7 0 1019 8.2" />
              </svg>
              {resending ? 'Resending...' : 'Resend Email'}
            </button>
          </div>

          {message ? (
            <p className={`mt-4 text-center text-sm ${message.includes('resent') ? 'text-gray-600' : 'text-red-600'}`}>
              {message}
            </p>
          ) : null}

          <div className="mt-6 rounded-xl bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Didn&apos;t receive the email?</p>
                <ul className="mt-2 space-y-1 text-xs text-gray-600">
                  <li>• Check your spam or junk folder</li>
                  <li>• Make sure the email address is correct</li>
                  <li>• Try resending the verification email</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">Need help?</p>
            <div className="mt-1 flex items-center justify-center gap-3 text-sm text-gray-900">
              <a
                href={`mailto:${encodeURIComponent(supportEmail)}`}
                className="underline underline-offset-2 hover:text-gray-700"
              >
                Contact Support
              </a>
              <Link to="/login" className="underline underline-offset-2 hover:text-gray-700">
                Back to Sign In
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
