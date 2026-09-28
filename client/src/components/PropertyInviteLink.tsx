import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

/** The same saved invite is shown after publishing and on subsequent visits. */
export function PropertyInviteLink({ propertyId }: { propertyId: string | null }) {
  const { user } = useAuth()
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    setToken(null)
    setError(null)
    setCopied(false)
    if (!user || !propertyId) {
      setError('Property link is unavailable.')
      setLoading(false)
      return
    }
    setLoading(true)
    void supabase.from('landlord_invite_links')
      .select('token')
      .eq('landlord_id', user.id)
      .eq('property_id', propertyId)
      .maybeSingle()
      .then(({ data, error: queryError }) => {
        if (cancelled) return
        setLoading(false)
        if (queryError || !data) {
          setError(queryError?.message || 'Property link is unavailable. Please try again later.')
          return
        }
        setToken(data.token)
      })
    return () => { cancelled = true }
  }, [user?.id, propertyId])

  const url = token && typeof window !== 'undefined' ? `${window.location.origin}/invite/${token}` : ''
  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setError(null)
    } catch {
      setError('Could not copy the link. You can select and copy it above.')
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5 text-left">
      <h2 className="text-lg font-medium text-gray-900">Share this property</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Invite tenants with this link. For 14 days after accepting, they can see and apply to all your active listings, not just this property.
      </p>
      {loading ? <p className="mt-4 text-sm text-gray-500">Loading share link…</p> : null}
      {url ? (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input aria-label="Property share link" readOnly value={url} onFocus={(event) => event.target.select()}
            className="min-w-0 flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700" />
          <button type="button" onClick={() => void copy()}
            className="shrink-0 rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white">
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-3 text-sm text-red-600">{error}</p> : null}
    </section>
  )
}