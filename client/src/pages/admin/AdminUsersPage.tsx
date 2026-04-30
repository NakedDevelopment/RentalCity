import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchAdminDirectory, type AdminDirectoryUser } from '../../lib/adminApi'
import { AdminPageHeader, AdminSearchInput, admin } from './adminUi'

const PAGE_SIZE = 25

function matchesSearch(u: AdminDirectoryUser, q: string): boolean {
  if (!q) return true
  const n = q.toLowerCase()
  const hay = [
    u.email,
    u.display_name ?? '',
    u.role,
    u.phone ?? '',
    u.id,
  ]
    .join(' ')
    .toLowerCase()
  return hay.includes(n)
}

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminDirectoryUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const rows = await fetchAdminDirectory()
        if (!cancelled) {
          setUsers(rows.sort((a, b) => (a.email || '').localeCompare(b.email || '')))
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load users')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return users
    return users.filter((u) => matchesSearch(u, q))
  }, [users, search])

  useEffect(() => {
    setPage(1)
  }, [search])

  const total = filtered.length
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const paginated = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE
    return filtered.slice(start, start + PAGE_SIZE)
  }, [filtered, page])

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <div>
      <AdminPageHeader
        title="User management"
        description="Roles, suspension status, and account details."
      />

      {loading ? (
        <p className={`${admin.contentTop} ${admin.loading}`}>Loading directory…</p>
      ) : error ? (
        <p className={`${admin.contentTop} ${admin.error}`}>{error}</p>
      ) : (
        <>
          <div
            className={`${admin.contentTop} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
          >
            <AdminSearchInput
              id="admin-users-search"
              label="Search users"
              value={search}
              onChange={setSearch}
              placeholder="Search email, name, role, phone, or id…"
            />
            <p className="text-sm tabular-nums text-gray-600">
              {total === 0 ? (
                'No matches'
              ) : (
                <>
                  Showing <span className="font-medium text-gray-800">{rangeStart}</span>–
                  <span className="font-medium text-gray-800">{rangeEnd}</span> of{' '}
                  <span className="font-medium text-gray-800">{total}</span>
                  {users.length !== total ? (
                    <span className="text-gray-400"> ({users.length} total)</span>
                  ) : null}
                </>
              )}
            </p>
          </div>

          <div className={`mt-6 ${admin.tableWrap}`}>
            <table className="min-w-full text-left text-sm">
              <thead className={admin.thead}>
                <tr>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Display name</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      {users.length === 0 ? 'No users in directory.' : 'No users match your search.'}
                    </td>
                  </tr>
                ) : (
                  paginated.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-800">{u.email || '—'}</td>
                      <td className="px-4 py-3 text-gray-700">{u.display_name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                          {u.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.is_suspended ? (
                          <span className="font-medium text-amber-700">Suspended</span>
                        ) : (
                          <span className="text-emerald-700">Active</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link to={`/admin/users/${u.id}`} className={admin.textLink}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

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
