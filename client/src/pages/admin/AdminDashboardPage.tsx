import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AdminPageHeader, admin } from './adminUi'

type CountState = { loading: boolean; error: string | null; values: Record<string, number> }

export function AdminDashboardPage() {
  const [state, setState] = useState<CountState>({ loading: true, error: null, values: {} })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [
          totalRes,
          landlordsRes,
          tenantsRes,
          adminsRes,
          supportOpenRes,
          reportsPendingRes,
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'landlord'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'tenant'),
          supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
          supabase.from('support_requests').select('*', { count: 'exact', head: true }).in('status', ['open', 'in_progress']),
          supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        ])
        if (cancelled) return
        const err =
          totalRes.error?.message ||
          landlordsRes.error?.message ||
          tenantsRes.error?.message ||
          adminsRes.error?.message ||
          supportOpenRes.error?.message ||
          reportsPendingRes.error?.message
        if (err) {
          setState({ loading: false, error: err, values: {} })
          return
        }
        setState({
          loading: false,
          error: null,
          values: {
            profiles: totalRes.count ?? 0,
            landlords: landlordsRes.count ?? 0,
            tenants: tenantsRes.count ?? 0,
            admins: adminsRes.count ?? 0,
            supportOpen: supportOpenRes.count ?? 0,
            reportsPending: reportsPendingRes.count ?? 0,
          },
        })
      } catch (e) {
        if (!cancelled) {
          setState({ loading: false, error: e instanceof Error ? e.message : 'Failed to load', values: {} })
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const v = state.values

  return (
    <div>
      <AdminPageHeader
        title="Dashboard"
        description="Overview of users and open operational work."
      />

      {state.loading ? (
        <p className={`${admin.contentTop} ${admin.loading}`}>Loading metrics…</p>
      ) : state.error ? (
        <p className={`${admin.contentTop} ${admin.error}`}>{state.error}</p>
      ) : (
        <div className={`${admin.contentTop} grid gap-4 sm:grid-cols-2 lg:grid-cols-3`}>
          <MetricCard title="Total profiles" value={v.profiles} to="/admin/users" />
          <MetricCard title="Tenants" value={v.tenants} to="/admin/users" />
          <MetricCard title="Landlords" value={v.landlords} to="/admin/users" />
          <MetricCard title="Admins" value={v.admins} to="/admin/users" />
          <MetricCard title="Open support requests" value={v.supportOpen} to="/admin/issues" highlight />
          <MetricCard title="Pending reports" value={v.reportsPending} to="/admin/issues" highlight />
        </div>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  to,
  highlight,
}: {
  title: string
  value: number
  to: string
  highlight?: boolean
}) {
  return (
    <Link
      to={to}
      className={`${admin.panel} p-5 transition hover:shadow-md ${
        highlight ? admin.metricHighlight : admin.metricDefault
      }`}
    >
      <p className={admin.metricTitle}>{title}</p>
      <p className={admin.metricValue}>{value}</p>
    </Link>
  )
}
