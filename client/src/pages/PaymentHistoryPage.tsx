import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency } from '../lib/propertyDraft'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'

type TenantPayment = {
  id: string
  date: string
  label: string
  amount: string
  status: string
}

type LandlordTransaction = {
  id: string
  date: string
  description: string
  triggeredBy: string
  amount: string
  status: string
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatDisplayStatus(s: string): string {
  const map: Record<string, string> = {
    succeeded: 'Paid',
    paid: 'Paid',
    completed: 'Completed',
    Completed: 'Completed',
    expired: 'Expired',
    failed: 'Failed',
  }
  return map[s?.toLowerCase()] ?? s ?? 'Pending'
}

function downloadCSV<T extends Record<string, string>>(rows: T[], headers: { key: keyof T; label: string }[], filename: string) {
  const headerRow = headers.map((h) => h.label).join(',')
  const escape = (v: string) => {
    const s = String(v ?? '')
    return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s
  }
  const dataRows = rows.map((row) => headers.map((h) => escape(String(row[h.key] ?? ''))).join(','))
  const csv = [headerRow, ...dataRows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function PaymentHistoryPage() {
  const { user } = useAuth()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [tenantPayments, setTenantPayments] = useState<TenantPayment[]>([])
  const [landlordTransactions, setLandlordTransactions] = useState<LandlordTransaction[]>([])
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadPayments() {
      if (!user || profileRole === null) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      if (profileRole === 'tenant') {
        const { data, error: err } = await supabase
          .from('payments')
          .select('id, application_id, amount_cents, status, created_at')
          .order('created_at', { ascending: false })

        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []) as Array<{ id: string; application_id: string | null; amount_cents: number; status: string; created_at: string }>

        setTenantPayments(
          rows.map((p) => ({
            id: p.id,
            date: formatDate(p.created_at),
            label: p.application_id
              ? `APP-${p.application_id.slice(0, 8).toUpperCase()}`
              : 'Application Fee',
            amount: formatCurrency(p.amount_cents),
            status: formatDisplayStatus(p.status),
          })),
        )
      } else {
        const { data, error: err } = await supabase
          .from('payments')
          .select('id, application_id, amount_cents, status, description, created_at, payer_id, application:application_id(property:property_id(title, address_line1))')
          .order('created_at', { ascending: false })

        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }

        const rows = (data ?? []).filter(
          (p: { payer_id?: string }) => p.payer_id === user.id
        ) as Array<{
          id: string
          application_id: string
          amount_cents: number
          status: string
          description: string | null
          created_at: string
          application?: { property?: { title?: string; address_line1?: string } }
        }>

        setLandlordTransactions(
          rows.map((p) => ({
            id: p.id,
            date: formatDate(p.created_at),
            description: p.description || 'Transaction',
            triggeredBy: p.application?.property?.title || p.application?.property?.address_line1 || '—',
            amount: formatCurrency(p.amount_cents),
            status: formatDisplayStatus(p.status),
          })),
        )
      }

      setLoading(false)
    }

    loadPayments()
  }, [user, profileRole])

  const filteredTenantPayments = useMemo(() => {
    if (statusFilter === 'all') return tenantPayments
    return tenantPayments.filter((p) => p.status.toLowerCase() === statusFilter.toLowerCase())
  }, [tenantPayments, statusFilter])

  const filteredLandlordTransactions = useMemo(() => {
    if (statusFilter === 'all') return landlordTransactions
    return landlordTransactions.filter((p) => p.status.toLowerCase() === statusFilter.toLowerCase())
  }, [landlordTransactions, statusFilter])

  const tenantStatuses = useMemo(() => {
    const s = new Set(tenantPayments.map((p) => p.status))
    return ['all', ...s]
  }, [tenantPayments])

  const landlordStatuses = useMemo(() => {
    const s = new Set(landlordTransactions.map((p) => p.status))
    return ['all', ...s]
  }, [landlordTransactions])

  const handleDownloadTenant = () => {
    downloadCSV(
      filteredTenantPayments,
      [
        { key: 'date', label: 'Date' },
        { key: 'applicationId', label: 'Application ID' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ],
      `payment-history-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  const handleDownloadLandlord = () => {
    downloadCSV(
      filteredLandlordTransactions,
      [
        { key: 'date', label: 'Date' },
        { key: 'description', label: 'Description' },
        { key: 'triggeredBy', label: 'Triggered By' },
        { key: 'amount', label: 'Amount' },
        { key: 'status', label: 'Status' },
      ],
      `transactions-${new Date().toISOString().slice(0, 10)}.csv`,
    )
  }

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (profileRole === 'landlord') {
    return (
      <div className="space-y-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 text-gray-600">
            <Link
              to="/account/settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
              aria-label="Back to settings"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-[2rem] font-medium text-gray-900">Payment History</h1>
          </div>
          <p className="mt-1 text-sm text-gray-600">
            View your match unlock transaction history and payment details.
          </p>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-[1.8rem] font-medium text-gray-900">Recent Transactions</h2>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownloadLandlord}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
                </svg>
                Export
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setStatusDropdownOpen((o) => !o)}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  {statusFilter === 'all' ? 'All Status' : statusFilter}
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {statusDropdownOpen ? (
                  <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                    {landlordStatuses.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setStatusFilter(s)
                          setStatusDropdownOpen(false)
                        }}
                        className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        {s === 'all' ? 'All Status' : s}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setStatusDropdownOpen(false)}
                      className="fixed inset-0 -z-10"
                      aria-hidden
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="mt-6 overflow-x-auto">
            {loading ? (
              <p className="py-8 text-sm text-gray-500">Loading transactions...</p>
            ) : filteredLandlordTransactions.length === 0 ? (
              <p className="py-8 text-sm text-gray-500">No transactions yet.</p>
            ) : (
              <table className="min-w-full border-separate border-spacing-y-0">
                <thead>
                  <tr className="text-left text-sm text-gray-500">
                    <th className="border-b border-gray-200 pb-4 pr-6 font-medium">Date</th>
                    <th className="border-b border-gray-200 pb-4 pr-6 font-medium">Description</th>
                    <th className="border-b border-gray-200 pb-4 pr-6 font-medium">Triggered By</th>
                    <th className="border-b border-gray-200 pb-4 pr-6 font-medium">Amount</th>
                    <th className="border-b border-gray-200 pb-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLandlordTransactions.map((transaction) => (
                    <tr key={transaction.id} className="text-sm text-gray-700">
                      <td className="border-b border-gray-100 py-4 pr-6">{transaction.date}</td>
                      <td className="border-b border-gray-100 py-4 pr-6">{transaction.description}</td>
                      <td className="border-b border-gray-100 py-4 pr-6 text-gray-500">{transaction.triggeredBy}</td>
                      <td className="border-b border-gray-100 py-4 pr-6 font-medium text-gray-900">{transaction.amount}</td>
                      <td className="border-b border-gray-100 py-4">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
                            transaction.status === 'Completed' || transaction.status === 'Paid'
                              ? 'bg-gray-100 text-gray-600'
                              : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {transaction.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {!loading && filteredLandlordTransactions.length > 0 ? (
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-sm text-gray-500">
                Showing {filteredLandlordTransactions.length} of {landlordTransactions.length} transactions
              </span>
            </div>
          ) : null}
        </section>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 flex items-center gap-3 text-gray-600">
        <Link
          to="/account/settings"
          className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
          aria-label="Back to settings"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[2rem] font-medium text-gray-900">Payment History</h1>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h2 className="text-[1.35rem] font-medium text-gray-900">Payment History</h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setStatusDropdownOpen((o) => !o)}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
              >
                {statusFilter === 'all' ? 'All Status' : statusFilter}
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {statusDropdownOpen ? (
                <div className="absolute right-0 top-full z-10 mt-1 min-w-[140px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {tenantStatuses.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setStatusFilter(s)
                        setStatusDropdownOpen(false)
                      }}
                      className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {s === 'all' ? 'All Status' : s}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setStatusDropdownOpen(false)}
                    className="fixed inset-0 -z-10"
                    aria-hidden
                  />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              onClick={handleDownloadTenant}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
              aria-label="Download payment history"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v12m0 0l4-4m-4 4l-4-4m-5 8h18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="min-h-[420px] px-4 py-4">
          {loading ? (
            <p className="py-8 text-sm text-gray-500">Loading payments...</p>
          ) : filteredTenantPayments.length === 0 ? (
            <p className="py-8 text-sm text-gray-500">No payments yet.</p>
          ) : (
            <div className="space-y-3">
              {filteredTenantPayments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                      $
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{payment.date}</p>
                      <p className="mt-1 text-sm text-gray-500">{payment.label}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{payment.amount}</p>
                      <p className="mt-1 text-xs text-gray-500">{payment.status}</p>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                      aria-label={`More actions for ${payment.applicationId}`}
                    >
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4zm0 8a2 2 0 110-4 2 2 0 010 4z" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {!loading && filteredTenantPayments.length > 0 ? (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-4 text-sm text-gray-500">
            <span>
              Showing {filteredTenantPayments.length} of {tenantPayments.length} payments
            </span>
          </div>
        ) : null}
      </section>
    </div>
  )
}
