import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

type InviteRow = { id: string; token: string; created_at: string }

export function LandlordInviteTenantsCard() {
  const { user } = useAuth()
  const [links, setLinks] = useState<InviteRow[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedToken, setCopiedToken] = useState<string | null>(null)

  const loadLinks = useCallback(async () => {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data, error: qErr } = await supabase
      .from('landlord_invite_links')
      .select('id, token, created_at')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20)
    setLoading(false)
    if (qErr) {
      setError(qErr.message)
      return
    }
    setLinks((data ?? []) as InviteRow[])
  }, [user])

  useEffect(() => {
    void loadLinks()
  }, [loadLinks])

  async function createLink() {
    if (!user) return
    setCreating(true)
    setError(null)
    const { data, error: insErr } = await supabase
      .from('landlord_invite_links')
      .insert({ landlord_id: user.id })
      .select('id, token, created_at')
      .single()
    setCreating(false)
    if (insErr) {
      setError(insErr.message)
      return
    }
    if (data) setLinks((prev) => [data as InviteRow, ...prev])
  }

  function inviteUrl(token: string) {
    if (typeof window === 'undefined') return ''
    return `${window.location.origin}/invite/${token}`
  }

  async function copyUrl(token: string) {
    const url = inviteUrl(token)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    } catch {
      setError('Could not copy to clipboard.')
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-medium text-gray-900">Invite prospective tenants</h2>
      <p className="mt-2 text-sm leading-6 text-gray-600">
        Already have a tenant in mind? Share a private link and skip the $200 placement fee — if they sign up through
        your link, their profile unlocks for free.
      </p>
      <p className="mt-1 text-sm leading-6 text-gray-500">
        For the first 10 days after they accept, they&apos;ll only see your active listings. Then they get full access
        to Rental City.
      </p>

      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        onClick={() => void createLink()}
        disabled={creating}
        className="mt-4 inline-flex items-center gap-2 rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
      >
        {creating ? 'Creating…' : 'Create invite link'}
      </button>

      <div className="mt-6 space-y-3">
        {loading ? <p className="text-sm text-gray-500">Loading links…</p> : null}
        {!loading && links.length === 0 ? (
          <p className="text-sm text-gray-500">No links yet. Create one to share with applicants.</p>
        ) : null}
        {links.map((row) => (
          <div key={row.id} className="flex flex-col gap-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate font-mono text-xs text-gray-700">{inviteUrl(row.token)}</p>
              <p className="mt-1 text-xs text-gray-400">
                Created {new Date(row.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copyUrl(row.token)}
              className="shrink-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-100"
            >
              {copiedToken === row.token ? 'Copied' : 'Copy link'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
