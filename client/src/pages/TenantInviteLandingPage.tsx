import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'
import { clearPendingLandlordInviteToken, getPendingLandlordInviteToken, setPendingLandlordInviteToken } from '../lib/pendingLandlordInvite'

type Preview = { ok: true; landlord_name: string; unavailable: boolean } | { ok: false }

export function TenantInviteLandingPage() {
  const { token } = useParams<{ token: string }>()
  const { user } = useAuth()
  const { role: profileRole } = useProfileRole(user)
  const navigate = useNavigate()
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [redeemError, setRedeemError] = useState<string | null>(null)
  const [redeeming, setRedeeming] = useState(false)
  const [previewError, setPreviewError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setPreviewError(false)
    if (!token || !/^[0-9a-f-]{36}$/i.test(token)) {
      setPreview({ ok: false })
      setLoading(false)
      return
    }
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase.rpc('preview_landlord_invite', { invite_token: token })
      if (cancelled) return
      if (error || !data || !(data as { ok?: boolean }).ok) {
        setLoading(false)
        if (!error && getPendingLandlordInviteToken() === token) clearPendingLandlordInviteToken()
        setPreview({ ok: false })
        return
      }
      const d = data as { ok: boolean; landlord_name?: string }
      try {
        const response = await fetch(`/api/invites/${encodeURIComponent(token)}/availability`, { cache: 'no-store' })
        if (!response.ok) throw new Error('Could not check invite availability')
        const availability = await response.json() as { unavailable: boolean }
        if (typeof availability.unavailable !== 'boolean') throw new Error('Invalid availability response')
        if (cancelled) return
        setPreview({ ok: true, landlord_name: d.landlord_name ?? 'Your host', unavailable: availability.unavailable })
      } catch {
        if (cancelled) return
        setPreviewError(true)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [token])

  async function redeemAndContinue() {
    if (!token || !user || !preview?.ok || preview.unavailable) return
    setRedeemError(null)
    setRedeeming(true)
    try {
      const { data, error } = await supabase.rpc('redeem_landlord_invite', { invite_token: token })
      if (error) throw error
      const row = data as { ok?: boolean; error?: string; property_id?: string | null }
      if (!row?.ok) {
        if (row?.error === 'tenants_only') {
          setRedeemError('This invite is for renter accounts. Switch to a tenant profile or create a tenant account.')
        } else if (row?.error === 'invalid_token') {
          setRedeemError('This invite link is not valid.')
        } else if (row?.error === 'active_invite') {
          setRedeemError('You are already in another host’s 14-day invitation period. You can use this link after that period ends.')
        } else {
          setRedeemError('Could not apply this invite.')
        }
        return
      }
      clearPendingLandlordInviteToken()
      window.dispatchEvent(new CustomEvent('rental-city-invite-redeemed'))
      navigate(row.property_id ? `/property/${row.property_id}` : '/matches', { replace: true })
    } catch {
      setRedeemError('Something went wrong. Try again.')
    } finally {
      setRedeeming(false)
    }
  }

  if (!token) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-gray-600">Missing invite link.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-medium text-gray-900 underline">
          Home
        </Link>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-gray-500">Checking invite…</p>
      </div>
    )
  }

  if (previewError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <p className="text-sm text-gray-600">Could not check property availability. Please refresh to try again.</p>
      </div>
    )
  }

  if (!preview?.ok) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-xl font-medium text-gray-900">Invalid or expired invite</h1>
        <p className="mt-3 text-sm text-gray-600">Ask your host for a new link.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-gray-900 underline">
          Back to Rental City
        </Link>
      </div>
    )
  }

  if (preview.unavailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <h1 className="text-2xl font-medium text-gray-900">
          This property has been leased and is no longer available.
        </h1>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-gray-900 underline">
          Back to Rental City
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <h1 className="text-2xl font-medium text-gray-900">You&apos;re invited to apply</h1>
      <p className="mt-4 text-sm leading-7 text-gray-600">
        <span className="font-medium text-gray-900">{preview.landlord_name}</span> invited you on Rental City. For{' '}
        <span className="font-medium">14 days</span> after you accept, you&apos;ll only see and apply to their listings.
        Then you can use the full marketplace.
      </p>

      {user && profileRole === 'landlord' ? (
        <p className="mt-6 text-sm text-amber-800">
          You&apos;re signed in as a landlord. Log in with a tenant account to use this invite, or create a new tenant
          account.
        </p>
      ) : null}

      {redeemError ? <p className="mt-4 text-sm text-red-600">{redeemError}</p> : null}

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        {user && profileRole === 'tenant' ? (
          <button
            type="button"
            disabled={redeeming}
            onClick={() => void redeemAndContinue()}
            className="inline-flex items-center justify-center rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
          >
            {redeeming ? 'Applying…' : 'Continue to listings'}
          </button>
        ) : (
          <>
            <Link
              to="/signup"
              onClick={() => setPendingLandlordInviteToken(token)}
              className="inline-flex items-center justify-center rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white"
            >
              Create account
            </Link>
            <Link
              to="/login"
              onClick={() => setPendingLandlordInviteToken(token)}
              className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Log in
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
