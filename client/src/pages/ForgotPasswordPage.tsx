import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    setSent(true)
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[314px]">
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm">
          <div className="mb-5 flex justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary text-white">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M10.707 1.293a1 1 0 00-1.414 0l-7 7A1 1 0 003 10h1v6a1 1 0 001 1h3a1 1 0 001-1v-3h2v3a1 1 0 001 1h3a1 1 0 001-1v-6h1a1 1 0 00.707-1.707l-7-7z" />
              </svg>
            </div>
          </div>

          <h1 className="text-center text-[2rem] font-medium text-gray-900">Rental City</h1>
          <p className="mt-1 text-center text-sm text-gray-500">Find your perfect match</p>

          <div className="mt-6 text-center">
            <h2 className="text-[1.75rem] font-medium text-gray-900">Reset your password</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                Email address
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  required
                />
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              {error ? <p className="mt-2 text-sm text-red-500">{error}</p> : null}
              {sent ? (
                <p className="mt-2 text-sm text-green-600">
                  Reset link sent. Check your email for the next step.
                </p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              <span>{loading ? 'Sending...' : 'Send reset link'}</span>
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </form>

          <div className="my-6 flex items-center gap-3 text-xs text-gray-400">
            <div className="h-px flex-1 bg-gray-200" />
            <span>or</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-500">Remember your password?</p>
            <Link to="/login" className="mt-1 inline-block text-[1.05rem] font-medium text-gray-900 hover:text-gray-700">
              Sign in
            </Link>
          </div>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center">
            <p className="text-sm text-gray-500">Need help?</p>
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-gray-900">
              <Link to="/support" className="underline underline-offset-2 hover:text-gray-700">
                Contact Support
              </Link>
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
