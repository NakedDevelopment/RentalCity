import { Fragment, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { aggregateTenantFunnel, type FunnelEventRow, type FunnelStepStat } from '../../../../shared/tenantFunnel'
import { AdminPageHeader, admin } from './adminUi'

const PAGE_SIZE = 1000

async function loadTenantFunnelEvents(): Promise<FunnelEventRow[]> {
  const rows: FunnelEventRow[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('funnel_events')
      .select('step, user_id, anonymous_id')
      .eq('user_type', 'tenant')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw new Error('Could not load tracking')
    const page = (data ?? []) as FunnelEventRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) return rows
  }
}

export function AdminTrackingPage() {
  const [stats, setStats] = useState<FunnelStepStat[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    loadTenantFunnelEvents()
      .then((rows) => {
        if (!cancelled) setStats(aggregateTenantFunnel(rows))
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load tracking')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const maxReached = stats?.reduce((max, step) => Math.max(max, step.reached), 0) ?? 0

  return (
    <div>
      <AdminPageHeader
        title="Tracking"
        description="How many tenants reach each sign-up and application step, and where they stop."
      />

      {loading ? (
        <p className={`${admin.contentTop} ${admin.loading}`}>Loading tracking…</p>
      ) : error ? (
        <p className={`${admin.contentTop} ${admin.error}`}>{error}</p>
      ) : stats ? (
        <div className={`${admin.contentTop} ${admin.tableWrap}`}>
          <table className="min-w-full text-left text-sm">
            <thead className={admin.thead}>
              <tr>
                <th className="px-4 py-3 font-medium">Step</th>
                <th className="px-4 py-3 font-medium">Reached</th>
                <th className="px-4 py-3 font-medium">Stopped here</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((step, index) => {
                const showGroup = index === 0 || stats[index - 1].group !== step.group
                const width = maxReached > 0 ? Math.round((step.reached / maxReached) * 100) : 0
                return (
                  <Fragment key={step.id}>
                    {showGroup ? (
                      <tr className="bg-gray-50">
                        <td colSpan={3} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                          {step.group}
                        </td>
                      </tr>
                    ) : null}
                    <tr className="border-t border-gray-100">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{step.label}</div>
                        <div className="mt-2 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-gray-100">
                          <div className="h-full rounded-full bg-[#3A7AFE]" style={{ width: `${width}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-gray-900">{step.reached}</td>
                      <td className="px-4 py-3 tabular-nums text-gray-900">{step.stopped}</td>
                    </tr>
                  </Fragment>
                )
              })}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-4 py-3 text-xs leading-5 text-gray-500">
            Reached counts distinct tenants. Stopped here counts tenants whose furthest step is this one.
            A tenant who skips a step and continues is not counted as stopped on the step they skipped.
          </p>
        </div>
      ) : null}
    </div>
  )
}
