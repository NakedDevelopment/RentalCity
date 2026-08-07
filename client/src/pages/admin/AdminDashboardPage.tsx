import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { supabase } from '../../lib/supabase'
import { AdminPageHeader, admin } from './adminUi'

const DAY_MS = 24 * 60 * 60 * 1000
const TREND_DAYS = 30

type SignupDay = { date: string; landlord: number; tenant: number }

type DashboardState = {
  loading: boolean
  error: string | null
  activeListings: number
  activeListingsNew: number
  totalLandlords: number
  newLandlords: number
  openSupport: number
  newSignups: number
  signupTrend: SignupDay[]
  propertiesByStatus: { status: string; count: number }[]
}

const STATUS_COLORS: Record<string, string> = {
  active: '#3A7AFE',
  inactive: '#F59E0B',
  draft: '#9CA3AF',
}

function dayKey(iso: string) {
  return iso.slice(0, 10)
}

export function AdminDashboardPage() {
  const [state, setState] = useState<DashboardState>({
    loading: true,
    error: null,
    activeListings: 0,
    activeListingsNew: 0,
    totalLandlords: 0,
    newLandlords: 0,
    openSupport: 0,
    newSignups: 0,
    signupTrend: [],
    propertiesByStatus: [],
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const cutoff = new Date(Date.now() - TREND_DAYS * DAY_MS).toISOString()

      try {
        const [
          activeRes,
          activeNewRes,
          landlordsRes,
          newLandlordsRes,
          supportOpenRes,
          recentProfilesRes,
          allPropertiesRes,
        ] = await Promise.all([
          supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('properties').select('*', { count: 'exact', head: true }).eq('status', 'active').gte('created_at', cutoff),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'landlord'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'landlord').gte('created_at', cutoff),
          supabase.from('support_requests').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
          supabase.from('profiles').select('role, created_at').gte('created_at', cutoff),
          supabase.from('properties').select('status'),
        ])
        if (cancelled) return

        const err =
          activeRes.error?.message ||
          activeNewRes.error?.message ||
          landlordsRes.error?.message ||
          newLandlordsRes.error?.message ||
          supportOpenRes.error?.message ||
          recentProfilesRes.error?.message ||
          allPropertiesRes.error?.message
        if (err) {
          setState((s) => ({ ...s, loading: false, error: err }))
          return
        }

        const byDay = new Map<string, { landlord: number; tenant: number }>()
        for (let i = TREND_DAYS - 1; i >= 0; i -= 1) {
          const key = dayKey(new Date(Date.now() - i * DAY_MS).toISOString())
          byDay.set(key, { landlord: 0, tenant: 0 })
        }
        for (const row of recentProfilesRes.data ?? []) {
          const key = dayKey(row.created_at as string)
          const bucket = byDay.get(key)
          if (!bucket) continue
          if (row.role === 'landlord') bucket.landlord += 1
          else if (row.role === 'tenant') bucket.tenant += 1
        }
        const signupTrend: SignupDay[] = Array.from(byDay.entries()).map(([date, v]) => ({ date, ...v }))
        const newSignups = signupTrend.reduce((sum, d) => sum + d.landlord + d.tenant, 0)

        const statusCounts = new Map<string, number>()
        for (const row of allPropertiesRes.data ?? []) {
          const status = (row.status as string) ?? 'unknown'
          statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1)
        }
        const propertiesByStatus = Array.from(statusCounts.entries()).map(([status, count]) => ({ status, count }))

        setState({
          loading: false,
          error: null,
          activeListings: activeRes.count ?? 0,
          activeListingsNew: activeNewRes.count ?? 0,
          totalLandlords: landlordsRes.count ?? 0,
          newLandlords: newLandlordsRes.count ?? 0,
          openSupport: supportOpenRes.count ?? 0,
          newSignups,
          signupTrend,
          propertiesByStatus,
        })
      } catch (e) {
        if (!cancelled) {
          setState((s) => ({ ...s, loading: false, error: e instanceof Error ? e.message : 'Failed to load dashboard' }))
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div>
      <AdminPageHeader title="Dashboard" description="Business health at a glance." />

      {state.loading ? (
        <p className={`${admin.contentTop} ${admin.loading}`}>Loading metrics…</p>
      ) : state.error ? (
        <p className={`${admin.contentTop} ${admin.error}`}>{state.error}</p>
      ) : (
        <>
          <div className={`${admin.contentTop} grid gap-4 sm:grid-cols-2 lg:grid-cols-4`}>
            <KpiCard
              title="Active Listings"
              value={state.activeListings}
              trend={`+${state.activeListingsNew} in last 30 days`}
              to="/admin/properties?status=active"
            />
            <KpiCard
              title="Total Landlords"
              value={state.totalLandlords}
              trend={`+${state.newLandlords} new in last 30 days`}
              to="/admin/users?role=landlord"
            />
            <KpiCard
              title="Open Support Requests"
              value={state.openSupport}
              trend="Needs attention"
              to="/admin/issues"
              highlight={state.openSupport > 0}
            />
            <KpiCard
              title="New Sign-ups (30d)"
              value={state.newSignups}
              trend="Landlords + tenants"
              to="/admin/users"
            />
          </div>

          <div className={`${admin.contentTop} grid gap-4 lg:grid-cols-2`}>
            <div className={admin.panelPaddedLg}>
              <h2 className={admin.detailTitle}>Sign-up trend (30 days)</h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={state.signupTrend}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(d: string) => d.slice(5)}
                      tick={{ fontSize: 11, fill: '#6B7280' }}
                      interval={4}
                    />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6B7280' }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="landlord" name="Landlords" stackId="signups" fill="#3A7AFE" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="tenant" name="Tenants" stackId="signups" fill="#00BBFF" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={admin.panelPaddedLg}>
              <h2 className={admin.detailTitle}>Properties by status</h2>
              <div className="mt-4 h-64">
                {state.propertiesByStatus.length === 0 ? (
                  <p className={admin.emptyState}>No properties yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={state.propertiesByStatus}
                        dataKey="count"
                        nameKey="status"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={2}
                      >
                        {state.propertiesByStatus.map((entry) => (
                          <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? '#9CA3AF'} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({
  title,
  value,
  trend,
  to,
  highlight,
}: {
  title: string
  value: number
  trend: string
  to: string
  highlight?: boolean
}) {
  return (
    <Link
      to={to}
      className={`${admin.panel} p-5 transition hover:shadow-md ${highlight ? admin.metricHighlight : admin.metricDefault}`}
    >
      <p className={admin.metricTitle}>{title}</p>
      <p className={admin.metricValue}>{value}</p>
      <p className="mt-1 text-xs text-gray-500">{trend}</p>
      <span className="mt-2 inline-block text-xs font-medium text-[#3A7AFE]">View all →</span>
    </Link>
  )
}
