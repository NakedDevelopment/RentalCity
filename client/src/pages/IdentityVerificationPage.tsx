import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import {
  createPlaidIdentityVerification,
  getPlaidIdentityStatus,
  type PlaidIdentityVerificationStatus,
} from '../lib/plaidApi'
import { supabase } from '../lib/supabase'

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function ShieldIcon() {
  return (
    <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
      />
    </svg>
  )
}

function StatusBadge({ status }: { status: PlaidIdentityVerificationStatus | null }) {
  if (!status) return null

  const map: Record<string, { label: string; cls: string }> = {
    success: { label: 'Verified', cls: 'bg-green-50 text-green-700' },
    failed: { label: 'Failed', cls: 'bg-red-50 text-red-700' },
    pending: { label: 'Pending', cls: 'bg-yellow-50 text-yellow-700' },
    active: { label: 'In progress', cls: 'bg-blue-50 text-blue-700' },
    expired: { label: 'Expired', cls: 'bg-gray-100 text-gray-600' },
    canceled: { label: 'Canceled', cls: 'bg-gray-100 text-gray-600' },
  }
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' }

  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${s.cls}`}>
      {s.label}
    </span>
  )
}

export function IdentityVerificationPage() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [status, setStatus] = useState<PlaidIdentityVerificationStatus | null>(null)
  const [shareableUrl, setShareableUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load current status on mount
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      const token = await getAccessToken()
      if (!token || cancelled) return
      try {
        const result = await getPlaidIdentityStatus(token)
        if (!cancelled) {
          setStatus(result.status)
          setShareableUrl(result.shareableUrl)
        }
      } catch {
        // No session yet — that's fine
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleStart = useCallback(async () => {
    setError(null)
    setStarting(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const result = await createPlaidIdentityVerification(token)
      setStatus(result.status)
      setShareableUrl(result.shareableUrl)
      // Open in a new window so the user can complete it and come back
      if (result.shareableUrl) {
        window.open(result.shareableUrl, '_blank', 'noopener,noreferrer')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start identity verification')
    } finally {
      setStarting(false)
    }
  }, [])

  const handleCheckStatus = useCallback(async () => {
    setError(null)
    setChecking(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const result = await getPlaidIdentityStatus(token)
      setStatus(result.status)
      setShareableUrl(result.shareableUrl)
      if (result.status === 'success') {
        // Small delay so the user sees the success state before redirect
        await new Promise((r) => setTimeout(r, 1200))
        navigate('/matches')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not check status')
    } finally {
      setChecking(false)
    }
  }, [navigate])

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-sm text-gray-500">Loading...</span>
      </div>
    )
  }

  const isSuccess = status === 'success'
  const isFailed = status === 'failed' || status === 'expired' || status === 'canceled'
  const isInProgress = status === 'active' || status === 'pending'
  const hasSession = status !== null

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-[502px] rounded-2xl border border-gray-200 bg-white px-5 py-7 shadow-sm">
        {/* Icon + title */}
        <div className="text-center">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-xl ${
              isSuccess ? 'bg-green-50 text-green-600' : 'bg-gray-900 text-white'
            }`}
          >
            <ShieldIcon />
          </div>
          <h1 className="mt-4 text-[2rem] font-medium text-gray-900">Verify your identity</h1>
          <div className="mt-2 flex items-center justify-center gap-2">
            <p className="text-sm text-gray-600">Powered by Plaid</p>
            {hasSession && <StatusBadge status={status} />}
          </div>
        </div>

        {/* Body content */}
        {isSuccess ? (
          <div className="mt-7 rounded-xl border border-green-100 bg-green-50 p-5 text-center">
            <p className="text-sm font-medium text-green-800">
              Identity verified! You can now browse listings and apply to properties.
            </p>
            <Link
              to="/matches"
              className="mt-4 inline-flex items-center gap-2 rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white"
            >
              View my matches
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        ) : isInProgress ? (
          <div className="mt-7 space-y-4">
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="text-sm text-blue-800">
                Your verification is in progress. Complete the steps in the Plaid window, then
                tap&nbsp;<strong>Check status</strong> to continue.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {shareableUrl && (
                <a
                  href={shareableUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white"
                >
                  Open verification
                </a>
              )}
              <button
                type="button"
                onClick={handleCheckStatus}
                disabled={checking}
                className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {checking ? 'Checking…' : 'Check status'}
              </button>
            </div>
          </div>
        ) : isFailed ? (
          <div className="mt-7 space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-sm text-red-800">
                {status === 'expired'
                  ? 'Your verification session expired. Please start a new one.'
                  : 'Verification was not completed. You can try again.'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Try again'}
            </button>
          </div>
        ) : (
          // No session yet — first time
          <div className="mt-7 space-y-5">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-medium text-gray-900">What to expect</p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                {[
                  'Takes about 2–3 minutes',
                  'A government-issued ID (passport or driver\'s license)',
                  'A short selfie or photo match step',
                  'Your information stays with Plaid — never stored on our servers',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <svg
                      className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              className="w-full rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
            >
              {starting ? 'Starting verification…' : 'Start identity verification'}
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}

        {/* Skip link — lets them get back to matches with a gated prompt */}
        {!isSuccess && (
          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/matches" className="underline hover:text-gray-700">
              Skip for now
            </Link>{' '}
            — required to browse properties
          </p>
        )}
      </div>
    </div>
  )
}
