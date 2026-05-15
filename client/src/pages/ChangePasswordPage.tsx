import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'

export function ChangePasswordPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (!user?.email) {
      setError('Unable to verify your account. Please try again.')
      return
    }

    setLoading(true)

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    })

    if (signInError) {
      setLoading(false)
      setError('Current password is incorrect')
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate(profileRole === 'admin' ? '/admin/profile' : '/account/settings')
  }

  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'Contains uppercase and lowercase letters', met: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
    { label: 'Contains at least one number', met: /\d/.test(newPassword) },
  ]

  function ToggleButton({
    visible,
    onClick,
    label,
  }: {
    visible: boolean
    onClick: () => void
    label: string
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {visible ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
          ) : (
            <>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </>
          )}
        </svg>
      </button>
    )
  }

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  const settingsPath = profileRole === 'admin' ? '/admin/profile' : '/account/settings'

  if (profileRole === 'landlord') {
    return (
      <div className="flex min-h-full flex-col py-6">
        <div>
          <div className="mb-6">
            <Link to={settingsPath} className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="mt-2 text-[2rem] font-medium text-gray-900">Change Password</h1>
            <p className="mt-1 text-sm text-gray-600">Update your password</p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white px-5 py-5 shadow-sm">
            <form onSubmit={handleSubmit}>
              <div className="space-y-5">
                <div>
                  <label htmlFor="current-password-landlord" className="mb-2 block text-sm font-medium text-gray-800">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      id="current-password-landlord"
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter your current password"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                      required
                    />
                    <ToggleButton
                      visible={showCurrentPassword}
                      onClick={() => setShowCurrentPassword((value) => !value)}
                      label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="new-password-landlord" className="mb-2 block text-sm font-medium text-gray-800">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password-landlord"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter your new password"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                      required
                    />
                    <ToggleButton
                      visible={showNewPassword}
                      onClick={() => setShowNewPassword((value) => !value)}
                      label={showNewPassword ? 'Hide new password' : 'Show new password'}
                    />
                  </div>

                  <div className="mt-2 text-xs text-gray-500">
                    <p>Password must contain:</p>
                    <div className="mt-1.5 space-y-1">
                      {requirements.map((requirement) => (
                        <div key={requirement.label} className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full ${requirement.met ? 'bg-gray-600' : 'bg-gray-300'}`} />
                          <span>{requirement.label.replace('Contains ', '').replace('at least one ', 'One ')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirm-password-landlord" className="mb-2 block text-sm font-medium text-gray-800">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password-landlord"
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirm your new password"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3.5 pr-12 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-200"
                      required
                    />
                    <ToggleButton
                      visible={showConfirmPassword}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                    />
                  </div>
                </div>
              </div>

              {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

              <button
                type="submit"
                disabled={loading}
                className="mt-7 flex w-full items-center justify-center gap-2 rounded-xl btn-primary py-3.5 text-sm font-medium text-white disabled:opacity-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm-7 9h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
                </svg>
                {loading ? 'Updating...' : 'Update Password'}
              </button>
            </form>

            <div className="mt-6 border-t border-gray-200 pt-6">
              <div className="rounded-xl bg-gray-50 px-4 py-4">
                <div className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v0H6a2 2 0 00-2 2v10a2 2 0 002 2zm3-14a3 3 0 016 0v0H9v0z" />
                  </svg>
                  <div className="text-sm text-gray-600">
                    <p className="font-medium text-gray-800">Security tip:</p>
                    <p className="mt-1">Choose a strong, unique password that you don't use for other accounts. Consider using a password manager.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    )
  }

  return (
    <div className="px-4 py-8">
      <div className="mb-6">
        <Link
          to={settingsPath}
          className="inline-flex items-center gap-2 text-gray-700 hover:text-gray-900"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-[2rem] font-medium">Change Password</span>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-5">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-5 w-5 text-gray-800" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c-1.657 0-3 .895-3 2v2h6v-2c0-1.105-1.343-2-3-2zm6 2v2a2 2 0 01-2 2H8a2 2 0 01-2-2v-2a2 2 0 012-2V9a4 4 0 118 0v2a2 2 0 012 2zm-6-8a2 2 0 00-2 2v2h4V7a2 2 0 00-2-2z" />
              </svg>
              <div>
                <h1 className="text-[1.75rem] font-medium text-gray-900">Change Password</h1>
                <p className="mt-2 text-sm text-gray-600">Update your password to keep your account secure</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5">
            <div className="space-y-5">
              <div>
                <label htmlFor="current-password" className="mb-2 block text-sm font-medium text-gray-800">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="current-password"
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    className="w-full rounded-xl border border-gray-300 px-5 py-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                    required
                  />
                  <ToggleButton
                    visible={showCurrentPassword}
                    onClick={() => setShowCurrentPassword((value) => !value)}
                    label={showCurrentPassword ? 'Hide current password' : 'Show current password'}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-800">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="new-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter your new password"
                    className="w-full rounded-xl border border-gray-300 px-5 py-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                    required
                  />
                  <ToggleButton
                    visible={showNewPassword}
                    onClick={() => setShowNewPassword((value) => !value)}
                    label={showNewPassword ? 'Hide new password' : 'Show new password'}
                  />
                </div>

                <div className="mt-3 space-y-1.5">
                  {requirements.map((requirement) => (
                    <div key={requirement.label} className="flex items-center gap-2 text-xs text-gray-600">
                      <span className={`h-2.5 w-2.5 rounded-full ${requirement.met ? 'bg-gray-600' : 'bg-gray-300'}`} />
                      <span>{requirement.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-800">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirm-password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm your new password"
                    className="w-full rounded-xl border border-gray-300 px-5 py-4 pr-12 text-base text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                    required
                  />
                  <ToggleButton
                    visible={showConfirmPassword}
                    onClick={() => setShowConfirmPassword((value) => !value)}
                    label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                  />
                </div>
              </div>
            </div>

            {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

            <div className="mt-6 space-y-3">
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center rounded-xl btn-primary py-3 text-sm font-medium text-white disabled:opacity-50"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>
              <Link
                to={settingsPath}
                className="flex w-full items-center justify-center rounded-xl border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <div className="flex items-start gap-2">
            <svg className="mt-0.5 h-4 w-4 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2V9a2 2 0 00-2-2h-1V7a5 5 0 00-10 0v0H6a2 2 0 00-2 2v10a2 2 0 002 2zm3-14a3 3 0 016 0v0H9v0z" />
            </svg>
            <div>
              <h2 className="text-sm font-medium text-gray-900">Password Security Tips</h2>
              <ul className="mt-3 space-y-2 text-xs text-gray-600">
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3.5 w-3.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Use a unique password that you don&apos;t use elsewhere</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3.5 w-3.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Avoid common words or personal information</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="mt-0.5 h-3.5 w-3.5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Consider using a password manager</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
