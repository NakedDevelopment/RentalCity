import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AdminPageHeader, admin } from './adminUi'

const PAGE_SIZE = 25

const notificationsNavState = { from: '/admin/notifications', fromLabel: 'Notifications' } as const

type Row = {
  id: string
  user_id: string
  title: string
  body: string | null
  type: string | null
  read_at: string | null
  created_at: string
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

export function AdminNotificationsPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [openId, setOpenId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data, error: qErr } = await supabase
        .from('notifications')
        .select('id, user_id, title, body, type, read_at, created_at')
        .order('created_at', { ascending: false })
        .limit(300)
      if (cancelled) return
      if (qErr) {
        setError(qErr.message)
        setLoading(false)
        return
      }
      setRows((data ?? []) as Row[])
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const total = rows.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return rows.slice(start, start + PAGE_SIZE)
  }, [rows, page])

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  function toggle(id: string) {
    setOpenId((cur) => (cur === id ? null : id))
  }

  return (
    <div>
      <AdminPageHeader
        title="Notifications"
        description="Delivery log across all users (read-only). Expand a card for full text and recipient."
      />

      {loading ? (
        <p className={`${admin.contentTop} ${admin.loading}`}>Loading…</p>
      ) : error ? (
        <p className={`${admin.contentTop} ${admin.error}`}>{error}</p>
      ) : (
        <>
          <div
            className={`${admin.contentTop} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <p className="text-sm tabular-nums text-gray-600">
              {total === 0 ? (
                'No notifications'
              ) : (
                <>
                  Showing <span className="font-medium text-gray-800">{rangeStart}</span>–
                  <span className="font-medium text-gray-800">{rangeEnd}</span> of{' '}
                  <span className="font-medium text-gray-800">{total}</span>
                </>
              )}
            </p>
          </div>

          <ul className="mt-6 flex list-none flex-col gap-4 p-0" aria-label="Notifications">
            {total === 0 ? (
              <li className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/90 py-16 text-center text-sm text-gray-500">
                No notifications.
              </li>
            ) : (
              paginated.map((r) => {
                const open = openId === r.id
                const read = Boolean(r.read_at)
                return (
                  <li
                    key={r.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-black/[0.03]"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(r.id)}
                      aria-expanded={open}
                      className="flex w-full items-start gap-4 px-5 py-4 text-left transition hover:bg-gray-50/90"
                    >
                      <span
                        className={`mt-0.5 inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ring-1 ring-inset ${
                          read
                            ? 'bg-gray-100 text-gray-600 ring-gray-200'
                            : 'bg-sky-100 text-sky-900 ring-sky-200'
                        }`}
                      >
                        {read ? 'Read' : 'Unread'}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-base font-semibold leading-snug text-gray-900">{r.title}</span>
                        <span className="mt-1 block text-sm text-gray-500">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                        {!open && r.body ? (
                          <span className="mt-1 block line-clamp-2 text-sm text-gray-500">{r.body}</span>
                        ) : null}
                      </span>
                      <Chevron open={open} />
                    </button>
                    {open ? (
                      <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-5 pb-5 pt-4">
                        {r.body ? (
                          <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 text-sm leading-relaxed text-gray-700 shadow-sm">
                            <p className="whitespace-pre-wrap">{r.body}</p>
                          </div>
                        ) : (
                          <p className={`${admin.muted} rounded-xl border border-dashed border-gray-200 bg-white px-4 py-3`}>
                            No message body for this notification.
                          </p>
                        )}
                        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Recipient</dt>
                            <dd className="mt-1 font-mono text-xs">
                              <Link
                                to={`/admin/users/${r.user_id}`}
                                state={notificationsNavState}
                                className="font-sans font-medium text-gray-900 underline-offset-2 hover:underline"
                                title={r.user_id}
                              >
                                {r.user_id.slice(0, 8)}…
                              </Link>
                            </dd>
                          </div>
                          <div>
                            <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Type</dt>
                            <dd className="mt-1 font-medium text-gray-800">{r.type ?? '—'}</dd>
                          </div>
                          {r.read_at ? (
                            <div className="sm:col-span-2">
                              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-400">Read at</dt>
                              <dd className="mt-1 text-gray-700">{new Date(r.read_at).toLocaleString()}</dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
                    ) : null}
                  </li>
                )
              })
            )}
          </ul>

          {total > 0 ? (
            <div className="mt-6 flex flex-col items-center justify-between gap-3 sm:flex-row">
              <p className={`${admin.muted} text-xs`}>
                Page {page} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={admin.btnSecondary}
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className={admin.btnSecondary}
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
