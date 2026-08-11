import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { Mail, Phone, Calendar, Clock, Home } from 'lucide-react'
import { fetchAdminDirectory, type AdminDirectoryUser } from '../../lib/adminApi'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/useAuth'
import { formatCurrency, formatBedrooms } from '../../lib/propertyDraft'
import { AdminPageHeader, AdminErrorBlock, admin } from './adminUi'
import { StatusBadge, PLACEHOLDER_IMAGES } from './AdminPropertiesPage'

type UserDetailNavState = { from?: string; fromLabel?: string }

type LandlordProperty = {
  id: string
  title: string | null
  address_line1: string
  city: string
  state: string | null
  status: string
  monthly_rent_cents: number
  bedrooms: number
  photo_urls: string[] | null
  created_at: string
}

function safeAdminBackPath(path: string | undefined): string | null {
  if (!path || typeof path !== 'string') return null
  if (!path.startsWith('/admin/') || path.includes('..')) return null
  return path
}

function formatDate(value: string | null | undefined): string {
  if (!value) return 'Never'
  return new Date(value).toLocaleDateString()
}

function RoleBadge({ role }: { role: string }) {
  const style =
    role === 'landlord'
      ? 'bg-[#EEF4FE] text-[#3A7AFE]'
      : role === 'admin'
        ? 'bg-violet-100 text-violet-800'
        : 'bg-emerald-50 text-emerald-800'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}>{role}</span>
}

function AccountStatusBadge({ suspended }: { suspended: boolean }) {
  return suspended ? (
    <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-900">
      Suspended
    </span>
  ) : (
    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">
      Active
    </span>
  )
}

function ProfileAvatar({ url, name }: { url: string | null; name: string }) {
  if (url) {
    return <img src={url} alt={name} className="h-16 w-16 rounded-full object-cover" />
  }
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full gradient-primary text-2xl font-semibold text-white">
      {initial}
    </div>
  )
}

export function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>()
  const location = useLocation()
  const { user } = useAuth()
  const [row, setRow] = useState<AdminDirectoryUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const [properties, setProperties] = useState<LandlordProperty[] | null>(null)
  const [propsLoading, setPropsLoading] = useState(false)
  const [propsError, setPropsError] = useState<string | null>(null)

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

  useEffect(() => {
    if (!id || row?.role !== 'landlord') return
    let cancelled = false
    ;(async () => {
      setPropsLoading(true)
      setPropsError(null)
      const { data, error: err } = await supabase
        .from('properties')
        .select('id, title, address_line1, city, state, status, monthly_rent_cents, bedrooms, photo_urls, created_at')
        .eq('landlord_id', id)
        .order('created_at', { ascending: false })
      if (cancelled) return
      if (err) {
        setPropsError(err.message)
      } else {
        setProperties((data ?? []) as LandlordProperty[])
      }
      setPropsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [id, row?.role])

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

  async function setEquifaxApproved(approve: boolean) {
    if (!id || !row || busy) return
    setBusy(true)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) { setBusy(false); return }
    try {
      const res = await fetch(`/api/admin/equifax/approve/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ approve }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        setError(j.error ?? 'Failed to update Equifax access')
        return
      }
      const now = new Date().toISOString()
      setRow({
        ...row,
        equifax_approved_at: approve ? now : null,
        equifax_pending_since: approve ? null : row.equifax_pending_since,
      })
    } finally {
      setBusy(false)
    }
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
  const trimmedName = row.display_name?.trim() || ''
  const displayName = trimmedName || '—'
  const avatarName = trimmedName || row.email
  const rentedCount = (properties ?? []).filter((p) => p.status === 'leased').length

  return (
    <div>
      <Link to={backTo} className={admin.textLink}>
        ← {backLabel}
      </Link>
      <div className="mt-2">
        <AdminPageHeader title="User details" />
      </div>

      <div className={`${admin.contentTop} max-w-3xl space-y-6`}>
        <div className={`${admin.panelPaddedLg} flex flex-wrap items-center gap-5`}>
          <ProfileAvatar url={row.avatar_url} name={avatarName} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xl font-semibold tracking-tight text-gray-900">{displayName}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <RoleBadge role={row.role} />
              <AccountStatusBadge suspended={row.is_suspended} />
            </div>
          </div>
        </div>

        <div className={admin.panelPaddedLg}>
          <h2 className={admin.detailTitle}>Contact & account info</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="flex items-start gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className={admin.fieldLabel}>Email</p>
                <a href={`mailto:${row.email}`} className="mt-1 block font-mono text-sm text-gray-900 hover:underline">
                  {row.email}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Phone className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className={admin.fieldLabel}>Phone</p>
                <p className="mt-1 text-sm text-gray-800">{row.phone ?? 'Not provided'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className={admin.fieldLabel}>Member since</p>
                <p className="mt-1 text-sm text-gray-800">{formatDate(row.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div>
                <p className={admin.fieldLabel}>Last seen</p>
                <p className="mt-1 text-sm text-gray-800">{formatDate(row.last_sign_in_at)}</p>
              </div>
            </div>
          </div>
        </div>

        {row.role === 'landlord' ? (
          <div className={admin.panelPaddedLg}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Home className="h-4 w-4 text-gray-400" />
                <h2 className={admin.detailTitle}>Listed properties</h2>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {properties?.length ?? 0}
                </span>
              </div>
              {properties && properties.length > 0 ? (
                <p className={admin.muted}>{rentedCount} rented out</p>
              ) : null}
            </div>

            <div className="mt-4">
              {propsLoading ? (
                <p className={admin.loading}>Loading properties…</p>
              ) : propsError ? (
                <AdminErrorBlock message={propsError} />
              ) : !properties || properties.length === 0 ? (
                <div className={admin.emptyState}>No properties listed yet.</div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2">
                  {properties.map((p, idx) => (
                    <Link
                      key={p.id}
                      to={`/admin/properties/${p.id}`}
                      className={`${admin.panel} block overflow-hidden transition hover:shadow-md`}
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-gray-100">
                        <img
                          src={p.photo_urls?.[0] ?? PLACEHOLDER_IMAGES[idx % PLACEHOLDER_IMAGES.length]}
                          alt={p.title || p.address_line1}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="space-y-1.5 p-4">
                        <div className="flex items-start justify-between gap-2">
                          <p className="truncate text-sm font-medium text-gray-900">{p.title || p.address_line1}</p>
                          <StatusBadge status={p.status} />
                        </div>
                        <p className="text-xs text-gray-500">{[p.city, p.state].filter(Boolean).join(', ')}</p>
                        <p className="text-sm text-gray-700">
                          {formatBedrooms(p.bedrooms)} · {formatCurrency(p.monthly_rent_cents)}/mo
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}

        {row.role === 'landlord' ? (
          <div className={admin.panelPaddedLg}>
            <h2 className={admin.detailTitle}>Equifax Credit Access</h2>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                {row.equifax_approved_at ? (
                  <>
                    <p className="text-sm font-medium text-green-700">Approved</p>
                    <p className="text-xs text-gray-500">Since {formatDate(row.equifax_approved_at)}</p>
                  </>
                ) : row.equifax_pending_since ? (
                  <>
                    <p className="text-sm font-medium text-amber-700">Pending approval</p>
                    <p className="text-xs text-gray-500">Requested {formatDate(row.equifax_pending_since)}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-500">Not requested</p>
                )}
              </div>
              {!isSelf && !isAdminRole ? (
                row.equifax_approved_at ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setEquifaxApproved(false)}
                    className={admin.btnWarning}
                  >
                    Revoke access
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void setEquifaxApproved(true)}
                    className={admin.btnSuccess}
                  >
                    Approve access
                  </button>
                )
              ) : null}
            </div>
          </div>
        ) : null}

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
