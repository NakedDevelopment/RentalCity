import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { fetchAdminDirectory, type AdminDirectoryUser } from '../../lib/adminApi'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { AdminPageHeader, admin } from './adminUi'

type UserDetailNavState = { from?: string; fromLabel?: string }

function safeAdminBackPath(path: string | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  if (!path.startsWith('/admin/') || path.includes('..')) return null
  return path
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const [row, setRow] = useState<AdminDirectoryUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchAdminDirectory()
        const found = rows.find((r) => r.id === id) ?? null
        if (!cancelled) {
          setRow(found)
          setError(found ? null : 'User not found')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  const navState = location.state as UserDetailNavState | null | undefined
  const backTo = safeAdminBackPath(navState?.from) ?? '/admin/users'
  const backLabel =
    backTo === '/admin/users'
      ? 'Users'
      : navState?.fromLabel && String(navState.fromLabel).trim()
        ? String(navState.fromLabel).trim()
        : 'Back'

  async function setSuspended(next: boolean) {
    if (!id || !row || busy) return
    setBusy(true)
    const { error: upErr } = await supabase.from('profiles').update({ is_suspended: next }).eq('id', id)
    setBusy(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setRow({ ...row, is_suspended: next })
  }

  if (loading) {
    return <p className="text-gray-500">Loading…</p>
  }
  if (!row || error === 'User not found') {
    return (
      <div>
        <p className="text-red-600">{error ?? 'Not found'}</p>
        <Link to={backTo} className={`mt-4 inline-block ${admin.textLink}`}>
          ← {backLabel}
        </Link>
      </div>
    )
  }

  const isSelf = user?.id === row.id
  const isAdminRole = row.role === 'admin'

  return (
    <div>
      <Link to={backTo} className={admin.textLink}>
        ← {backLabel}
      </Link>
      <div className="mt-2">
        <AdminPageHeader title="User details" />
      </div>

      <div className={`${admin.contentTop} max-w-lg space-y-4 ${admin.panelPaddedLg}`}>
        <div>
          <p className={admin.fieldLabel}>Email</p>
          <p className="mt-1 font-mono text-sm text-gray-900">{row.email}</p>
        </div>
        <div>
          <p className={admin.fieldLabel}>Display name</p>
          <p className="mt-1 text-gray-800">{row.display_name ?? '—'}</p>
        </div>
        <div>
          <p className={admin.fieldLabel}>Phone</p>
          <p className="mt-1 text-gray-800">{row.phone ?? 'Not provided'}</p>
        </div>
        <div>
          <p className={admin.fieldLabel}>Role</p>
          <p className="mt-1 text-gray-800">{row.role}</p>
        </div>
        <div>
          <p className={admin.fieldLabel}>Status</p>
          <p className="mt-1">
            {row.is_suspended ? (
              <span className="font-medium text-amber-800">Suspended</span>
            ) : (
              <span className="text-emerald-800">Active</span>
            )}
          </p>
        </div>
        <div>
          <p className={admin.fieldLabel}>User id</p>
          <p className="mt-1 font-mono text-xs break-all text-gray-600">{row.id}</p>
        </div>

        {error && error !== 'User not found' ? <p className={admin.error}>{error}</p> : null}

        <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
          {!isSelf && !isAdminRole ? (
            row.is_suspended ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setSuspended(false)}
                className={admin.btnSuccess}
              >
                Reactivate user
              </button>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => void setSuspended(true)}
                className={admin.btnWarning}
              >
                Suspend user
              </button>
            )
          ) : null}
          {isSelf ? <p className={admin.muted}>You cannot suspend your own admin account here.</p> : null}
          {isAdminRole && !isSelf ? (
            <p className={admin.muted}>Suspend other admins from the database if required.</p>
          ) : null}
        </div>
      </div>
    </div>
  )
}
