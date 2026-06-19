import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const normalizedError =
    error && /email.*not found|user.*not found|no user/i.test(error)
      ? 'Email address not found'
      : error && /invalid login credentials|invalid credentials|password/i.test(error)
        ? 'Password incorrect'
        : error
  const emailError = normalizedError === 'Email address not found' ? normalizedError : null
  const passwordError = normalizedError === 'Password incorrect' ? normalizedError : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message)
      return
    }
    const uid = data.user?.id
    if (uid) {
      const { data: prof } = await supabase.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (prof?.role === 'admin') {
        navigate('/admin', { replace: true })
        return
      }
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="flex-1 flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-[510px]">
        <div className="rounded-2xl border border-gray-200 bg-white px-12 py-10 shadow-sm">
          <div className="mb-6 flex justify-center">
            <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-8 w-auto" />
          </div>

          <h1 className="mb-2 text-center text-[2rem] font-medium text-gray-900">Sign In</h1>
          <p className="mb-8 text-center text-sm text-gray-600">Welcome back to Rental City</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-700">
                Email
              </label>
              <div className="relative">
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  className="w-full rounded-lg border border-gray-300 px-10 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  required
                />
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              {emailError ? <p className="mt-1 text-sm text-red-500">{emailError}</p> : null}
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border border-gray-300 px-10 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  required
                />
                <svg className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.657 0-3 .895-3 2v2h6v-2c0-1.105-1.343-2-3-2zm6 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2a2 2 0 012-2V9a4 4 0 118 0v2a2 2 0 012 2zm-6-8a2 2 0 00-2 2v2h4V7a2 2 0 00-2-2z" />
                </svg>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {showPassword ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    ) : (
                      <>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </>
                    )}
                  </svg>
                </button>
              </div>
              {passwordError ? <p className="mt-1 text-sm text-red-500">{passwordError}</p> : null}
            </div>

            <div className="text-right">
              <Link to="/login/forgot-password" className="text-sm text-gray-700 hover:text-gray-900">
                Forgot your password?
              </Link>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500">Don&apos;t have an account?</p>
            <Link to="/signup" className="mt-3 inline-block text-base font-medium text-gray-900 hover:text-gray-700">
              Create an account
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
