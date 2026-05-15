import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AdminPageHeader, admin } from './adminUi'

const issuesNavState = { from: '/admin/issues', fromLabel: 'Issues' } as const

type SupportRow = {
  id: string
  subject: string
  message: string
  status: string
  created_at: string
  user_id: string
  profile: { display_name: string | null } | null
}

type ReportRow = {
  id: string
  reason: string
  details: string | null
  status: string
  created_at: string
  reporter_id: string
  reported_user_id: string
  reporter: { display_name: string | null } | null
  reported: { display_name: string | null } | null
}

function supportStatusStyles(status: string) {
  switch (status) {
    case 'open':
      return 'bg-sky-100 text-sky-900 ring-1 ring-inset ring-sky-200'
    case 'in_progress':
      return 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-200'
    case 'resolved':
      return 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200'
    case 'closed':
      return 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200'
    default:
      return 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200'
  }
}

function reportStatusStyles(status: string) {
  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-200'
    case 'reviewed':
      return 'bg-indigo-100 text-indigo-900 ring-1 ring-inset ring-indigo-200'
    case 'resolved':
      return 'bg-emerald-100 text-emerald-900 ring-1 ring-inset ring-emerald-200'
    case 'dismissed':
      return 'bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200'
    default:
      return 'bg-gray-100 text-gray-700 ring-1 ring-inset ring-gray-200'
  }
}

function formatSupportStatus(s: string) {
  return s.replace(/_/g, ' ')
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export function AdminIssuesPage() {
  const [tab, setTab] = useState<'support' | 'reports'>('support')
  const [support, setSupport] = useState<SupportRow[]>([])
  const [reports, setReports] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [openSupportId, setOpenSupportId] = useState<string | null>(null)
  const [openReportId, setOpenReportId] = useState<string | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const [sRes, rRes] = await Promise.all([
        supabase
          .from('support_requests')
          .select(
            'id, subject, message, status, created_at, user_id, profile:profiles!support_requests_user_id_fkey(display_name)',
          )
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('reports')
          .select(
            `id, reason, details, status, created_at, reporter_id, reported_user_id,
             reporter:profiles!reports_reporter_id_fkey(display_name),
             reported:profiles!reports_reported_user_id_fkey(display_name)`,
          )
          .order('created_at', { ascending: false })
          .limit(200),
      ])
      if (cancelled) return
      if (sRes.error) {
        setError(sRes.error.message)
        setLoading(false)
        return
      }
      if (rRes.error) {
        setError(rRes.error.message)
        setLoading(false)
        return
      }
      const rawS = (sRes.data ?? []) as unknown as SupportRow[]
      const rawR = (rRes.data ?? []) as unknown as ReportRow[]
      setSupport(
        rawS.map((r) => ({
          ...r,
          profile: Array.isArray(r.profile) ? (r.profile[0] ?? null) : r.profile,
        })),
      )
      setReports(
        rawR.map((r) => ({
          ...r,
          reporter: Array.isArray(r.reporter) ? (r.reporter[0] ?? null) : r.reporter,
          reported: Array.isArray(r.reported) ? (r.reported[0] ?? null) : r.reported,
        })),
      )
      setError(null)
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function updateSupportStatus(id: string, status: string) {
    setStatusBusy(true)
    const { error: upErr } = await supabase.from('support_requests').update({ status }).eq('id', id)
    setStatusBusy(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setSupport((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  async function updateReportStatus(id: string, status: string) {
    setStatusBusy(true)
    const { error: upErr } = await supabase.from('reports').update({ status }).eq('id', id)
    setStatusBusy(false)
    if (upErr) {
      setError(upErr.message)
      return
    }
    setReports((rows) => rows.map((r) => (r.id === id ? { ...r, status } : r)))
  }

  function toggleSupport(id: string) {
    setOpenSupportId((cur) => (cur === id ? null : id))
  }

  function toggleReport(id: string) {
    setOpenReportId((cur) => (cur === id ? null : id))
  }

  return (
    <div>
      <AdminPageHeader
        title="Issues"
        description="Support tickets and user-safety reports. Expand a card for full text; status updates save immediately."
      />

      <div className={`${admin.contentTop} flex flex-wrap items-center gap-3`}>
        <div className="inline-flex rounded-full bg-gray-100 p-1 ring-1 ring-gray-200/80">
          <button
            type="button"
            onClick={() => setTab('support')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === 'support' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Support ({support.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('reports')}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === 'reports' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Reports ({reports.length})
          </button>
        </div>
      </div>

      <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-600">
        {tab === 'support' ? (
          <>
            <span className="font-medium text-gray-800">Support</span> tickets come from signed-in tenants and landlords via{' '}
            <span className="font-medium text-gray-800">/support</span> and{' '}
            <span className="font-medium text-gray-800">Account settings → Support</span>.
          </>
        ) : (
          <>
            <span className="font-medium text-gray-800">Reports</span> are submitted from{' '}
            <span className="font-medium text-gray-800">Messages → Report user</span>. The reported person must be the other
            participant in that conversation (enforced in the database).
          </>
        )}
      </p>

      {error ? <p className={`mt-4 ${admin.error}`}>{error}</p> : null}

      {loading ? (
        <p className={`mt-8 ${admin.loading}`}>Loading…</p>
      ) : tab === 'support' ? (
        <ul className="mt-8 flex list-none flex-col gap-4 p-0" aria-label="Support requests">
          {support.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/90 py-16 text-center text-sm text-gray-500">
              No support requests yet.
            </li>
          ) : (
            support.map((r) => {
              const open = openSupportId === r.id
              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => toggleSupport(r.id)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-gray-50/90"
                  >
                    <span
                      className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${supportStatusStyles(r.status)}`}
                    >
                      {formatSupportStatus(r.status)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold leading-snug text-gray-900">{r.subject}</span>
                      <span className="mt-1 block text-sm text-gray-500">
                        {r.profile?.display_name ?? 'Unknown user'} · {new Date(r.created_at).toLocaleString()}
                      </span>
                    </span>
                    <Chevron open={open} />
                  </button>
                  {open ? (
                    <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-5 pb-5 pt-4">
                      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-sm">
                        <p className="whitespace-pre-wrap">{r.message}</p>
                      </div>
                      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                        <span className="text-gray-500">Requester</span>
                        <Link
                          to={`/admin/users/${r.user_id}`}
                          state={issuesNavState}
                          className="font-medium text-gray-900 underline-offset-2 hover:underline"
                        >
                          {r.profile?.display_name ?? `User ${r.user_id.slice(0, 8)}…`}
                        </Link>
                      </div>
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Update status</p>
                        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
                          {(['open', 'in_progress', 'resolved', 'closed'] as const).map((s) => {
                            const active = r.status === s
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={statusBusy || active}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void updateSupportStatus(r.id, s)
                                }}
                                className={`rounded-lg px-3 py-2 text-xs font-medium transition ${
                                  active
                                    ? 'cursor-default gradient-primary text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                                }`}
                              >
                                {formatSupportStatus(s)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>
      ) : (
        <ul className="mt-8 flex list-none flex-col gap-4 p-0" aria-label="Landlord reports">
          {reports.length === 0 ? (
            <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/90 py-16 text-center text-sm text-gray-500">
              No reports yet.
            </li>
          ) : (
            reports.map((r) => {
              const open = openReportId === r.id
              return (
                <li
                  key={r.id}
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/[0.03]"
                >
                  <button
                    type="button"
                    onClick={() => toggleReport(r.id)}
                    aria-expanded={open}
                    className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-gray-50/90"
                  >
                    <span
                      className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${reportStatusStyles(r.status)}`}
                    >
                      {r.status}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-base font-semibold leading-snug text-gray-900">{r.reason}</span>
                      <span className="mt-1 block text-sm text-gray-500">
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </span>
                    <Chevron open={open} />
                  </button>
                  {open ? (
                    <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-5 pb-5 pt-4">
                      {r.details ? (
                        <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-sm">
                          <p className="whitespace-pre-wrap">{r.details}</p>
                        </div>
                      ) : (
                        <p className={`${admin.muted} rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3`}>
                          No additional narrative from the landlord.
                        </p>
                      )}
                      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reporter</dt>
                          <dd className="mt-1">
                            <Link
                              to={`/admin/users/${r.reporter_id}`}
                              state={issuesNavState}
                              className="font-medium text-gray-900 underline-offset-2 hover:underline"
                            >
                              {r.reporter?.display_name ?? `User ${r.reporter_id.slice(0, 8)}…`}
                            </Link>
                          </dd>
                        </div>
                        <div>
                          <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Reported tenant</dt>
                          <dd className="mt-1">
                            <Link
                              to={`/admin/users/${r.reported_user_id}`}
                              state={issuesNavState}
                              className="font-medium text-gray-900 underline-offset-2 hover:underline"
                            >
                              {r.reported?.display_name ?? `User ${r.reported_user_id.slice(0, 8)}…`}
                            </Link>
                          </dd>
                        </div>
                      </dl>
                      <div className="mt-5">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Update status</p>
                        <div className="mt-2 inline-flex flex-wrap gap-1 rounded-xl bg-gray-100 p-1">
                          {(['pending', 'reviewed', 'resolved', 'dismissed'] as const).map((s) => {
                            const active = r.status === s
                            return (
                              <button
                                key={s}
                                type="button"
                                disabled={statusBusy || active}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  void updateReportStatus(r.id, s)
                                }}
                                className={`rounded-lg px-3 py-2 text-xs font-medium capitalize transition ${
                                  active
                                    ? 'cursor-default gradient-primary text-white shadow-sm'
                                    : 'text-gray-600 hover:bg-white hover:text-gray-900 hover:shadow-sm'
                                }`}
                              >
                                {s}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
