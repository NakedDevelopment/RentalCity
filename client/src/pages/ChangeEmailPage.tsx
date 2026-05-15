import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'

export function ChangeEmailPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [newEmail, setNewEmail] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const { error: updateError } = await supabase.auth.updateUser({ email: newEmail })

    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/account/settings')
  }

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (profileRole === 'landlord') {
    return (
      <div className="flex min-h-full flex-col py-6">
        <div>
          <div className="mb-6">
            <Link to="/account/settings" className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="mt-2 text-[2rem] font-medium text-gray-900">Change Email Address</h1>
            <p className="mt-1 text-sm text-gray-600">Update your account email address</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="current-email" className="mb-2 block text-sm font-medium text-gray-800">
                    Current Email
                  </label>
                  <div className="relative">
                    <input
                      id="current-email"
                      type="email"
                      value={user?.email ?? ''}
                      readOnly
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-11 text-sm text-gray-500"
                    />
                    <svg className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <div>
                  <label htmlFor="new-email" className="mb-2 block text-sm font-medium text-gray-800">
                    New Email Address
                  </label>
                  <div className="relative">
                    <input
                      id="new-email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="Enter your new email address"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                      required
                    />
                    <svg className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-800">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password to confirm"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                      required
                    />
                    <svg className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm-7 9h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">We need your password to confirm this change for security purposes</p>
                </div>
              </div>

              <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                <div className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="text-sm text-gray-600">
                    <p>
                      <span className="font-semibold text-gray-800">Important:</span> After updating your email address:
                    </p>
                    <p className="mt-1">You&apos;ll receive a verification email at your new address</p>
                    <p>Your new email will be used for all future communications</p>
                    <p>You&apos;ll need to use the new email for login</p>
                  </div>
                </div>
              </div>

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

              <div className="mt-7 flex items-center justify-between gap-4">
                <Link
                  to="/account/settings"
                  className="inline-flex min-w-[72px] items-center justify-center rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </Link>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex min-w-[130px] items-center justify-center gap-2 rounded-xl btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
                >
                  {loading ? 'Updating...' : 'Update Email'}
                  {!loading ? (
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14m-5-5l5 5-5 5" />
                    </svg>
                  ) : null}
                </button>
              </div>
            </form>
          </div>
        </div>

      </div>
    )
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6">
        <Link
          to="/account/settings"
          className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[2rem] font-medium">Change Email</span>
        </Link>
      </div>

      <div className="space-y-5">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              <div>
                <h1 className="text-[1.75rem] font-medium text-gray-900">Update Email Address</h1>
                <p className="mt-2 text-sm text-gray-600">
                  Enter your new email address and confirm your password to update your account.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="rounded-xl bg-gray-50 px-4 py-4">
              <p className="mb-1 text-sm text-gray-600">Current Email</p>
              <p className="text-base text-gray-900">{user?.email ?? 'john.doe@email.com'}</p>
            </div>

            <div className="mt-6 space-y-5">
              <div>
                <label htmlFor="new-email-tenant" className="mb-2 block text-sm font-medium text-gray-800">
                  New Email Address
                </label>
                <div className="relative">
                  <input
                    id="new-email-tenant"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="Enter your new email address"
                    className="w-full rounded-xl border border-gray-300 px-5 py-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                    required
                  />
                  <svg className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password-tenant" className="mb-2 block text-sm font-medium text-gray-800">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password-tenant"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full rounded-xl border border-gray-300 px-5 py-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                    required
                  />
                  <svg className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.657 0-3 .895-3 2v2h6v-2c0-1.105-1.343-2-3-2zm6 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2a2 2 0 012-2V9a4 4 0 118 0v2a2 2 0 012 2zm-6-8a2 2 0 00-2 2v2h4V7a2 2 0 00-2-2z" />
                  </svg>
                </div>
                <p className="mt-1 text-xs text-gray-500">We need your current password to confirm this change</p>
              </div>
            </div>

            <div className="mt-6 rounded-xl bg-gray-50 px-4 py-4">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full text-gray-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">Security Notice</p>
                  <p className="mt-1 text-xs text-gray-600">
                    You&apos;ll receive a verification email at your new address. Your email won&apos;t be updated until you verify it.
                  </p>
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 flex gap-3">
              <Link
                to="/account/settings"
                className="inline-flex min-w-[76px] items-center justify-center rounded-xl border border-gray-300 px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex min-w-[102px] items-center justify-center rounded-xl btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Email'}
              </button>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5">
          <h2 className="text-[1.75rem] font-medium text-gray-900">What happens next?</h2>
          <ol className="mt-4 space-y-4">
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">1</span>
              <span className="text-sm text-gray-700">We&apos;ll send a verification email to your new address</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">2</span>
              <span className="text-sm text-gray-700">Click the verification link in that email</span>
            </li>
            <li className="flex items-start gap-3">
              <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">3</span>
              <span className="text-sm text-gray-700">Your email address will be updated automatically</span>
            </li>
          </ol>
        </div>

      </div>
    </div>
  )
}
