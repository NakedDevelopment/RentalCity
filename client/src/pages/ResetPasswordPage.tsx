import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const RECOVERY_TIMEOUT_MS = 10000

// Supabase's recovery-link redirect carries `type=recovery` plus an actual
// token (`access_token` for the implicit flow, `code` for PKCE) in the URL
// hash/query. Requiring the token itself (not just the guessable `type=
// recovery` string) is what distinguishes a real "came from the reset email"
// visit from a plain logged-in session landing on this page directly.
function looksLikeRecoveryLink(): boolean {
  const hash = window.location.hash.replace(/^#/, '')
  const hashParams = new URLSearchParams(hash)
  const searchParams = new URLSearchParams(window.location.search)
  const isRecoveryType = hashParams.get('type') === 'recovery' || searchParams.get('type') === 'recovery'
  const hasToken = Boolean(hashParams.get('access_token') || searchParams.get('code'))
  return isRecoveryType && hasToken
}

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
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const location = useLocation()
  // Set by RecoveryLinkHandler when it forwards a recovery login whose URL
  // token was already consumed by the Supabase SDK on another route.
  const forwardedRecovery = Boolean((location.state as { recovery?: boolean } | null)?.recovery)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [recoveryReady, setRecoveryReady] = useState(false)
  const [linkError, setLinkError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const cameFromRecoveryRedirect = looksLikeRecoveryLink() || forwardedRecovery

    const markReady = () => {
      if (cancelled) return
      setRecoveryReady(true)
      setLinkError(null)
    }

    // Always listen for PASSWORD_RECOVERY — this event only fires for real
    // recovery logins, so it is safe to trust even when the URL token was
    // already consumed on another route before we could inspect it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') markReady()
    })

    // Covers the case where the PASSWORD_RECOVERY event already fired (URL
    // token parsed) before this listener was attached. Safe to trust
    // getSession() here only because the recovery redirect (URL token or the
    // RecoveryLinkHandler forward) already confirmed this page load came
    // from a reset email — a plain logged-in session must not unlock this
    // form, since it would let anyone at an unlocked device change the
    // password without knowing the current one.
    if (cameFromRecoveryRedirect) {
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelled && data.session) markReady()
      })
    }

    const timeout = setTimeout(() => {
      if (!cancelled) {
        setRecoveryReady((ready) => {
          if (!ready) setLinkError('This reset link is invalid or has expired. Please request a new one.')
          return ready
        })
      }
    }, RECOVERY_TIMEOUT_MS)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  const requirements = [
    { label: 'At least 8 characters', met: newPassword.length >= 8 },
    { label: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'One lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'One number', met: /\d/.test(newPassword) },
  ]

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)

    if (!recoveryReady) {
      setError('Still verifying your reset link — please wait a moment and try again.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
    setLoading(false)

    if (updateError) {
      setError(updateError.message)
      return
    }

    navigate('/login')
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-[314px]">
        <div className="rounded-2xl border border-gray-200 bg-white px-5 py-6 shadow-sm">
          <div className="mb-3 flex justify-center">
            <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-9 w-auto" />
          </div>
          <p className="mt-1 text-center text-sm text-gray-500">Find your perfect match</p>

          <div className="mt-6 text-center">
            <h2 className="text-[1.75rem] font-medium text-gray-900">Create new password</h2>
            <p className="mt-2 text-sm leading-6 text-gray-600">
              Your new password must be different from previous used passwords.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-gray-700">
                New password
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Enter new password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  required
                />
                <ToggleButton
                  visible={showNewPassword}
                  onClick={() => setShowNewPassword((value) => !value)}
                  label={showNewPassword ? 'Hide new password' : 'Show new password'}
                />
              </div>
            </div>

            <div>
              <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-gray-700">
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirm-password"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm new password"
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
                  required
                />
                <ToggleButton
                  visible={showConfirmPassword}
                  onClick={() => setShowConfirmPassword((value) => !value)}
                  label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                />
              </div>
            </div>

            <div className="rounded-lg bg-gray-50 px-4 py-4">
              <p className="text-sm font-medium text-gray-700">Password must contain:</p>
              <div className="mt-3 space-y-1.5">
                {requirements.map((requirement) => (
                  <div key={requirement.label} className="flex items-center gap-2 text-sm text-gray-600">
                    <span className={`h-2.5 w-2.5 rounded-full border ${requirement.met ? 'border-gray-600 bg-gray-600' : 'border-gray-400 bg-transparent'}`} />
                    <span>{requirement.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {linkError ? (
              <p className="text-sm text-red-500">
                {linkError} <Link to="/forgot-password" className="underline">Request a new link</Link>
              </p>
            ) : null}

            {error ? <p className="text-sm text-red-500">{error}</p> : null}

            <button
              type="submit"
              disabled={loading || !recoveryReady || !!linkError}
              className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {linkError ? 'Link expired' : loading ? 'Updating...' : !recoveryReady ? 'Verifying reset link...' : 'Update Password'}
            </button>
          </form>

          <div className="mt-6 border-t border-gray-200 pt-4 text-center">
            <p className="text-sm text-gray-500">Need help?</p>
            <div className="mt-2 flex items-center justify-center gap-4 text-sm text-gray-700">
              <Link to="/support" className="inline-flex items-center gap-1.5 hover:text-gray-900">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Contact Support
              </Link>
              <Link to="/support" className="inline-flex items-center gap-1.5 hover:text-gray-900">
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 1.83-2 3.272-2 1.933 0 3.5 1.343 3.5 3 0 1.252-.896 2.326-2.167 2.784-.873.315-1.333.833-1.333 1.716V15m.001 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                FAQ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
