import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Home, Users, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { admin } from './adminUi'

type Metric = { current: number; prior: number; series: number[] }
type ActivityItem = { kind: string; label: string; sub: string | null; at: string; href: string | null }

type Stats = {
  period: string
  generatedAt: string
  rentalReports: Metric
  newListings: Metric
  newRenters: Metric
  revenue: { currentCents: number; priorCents: number; billingEnabled: boolean }
  dau: { tracked: boolean }
  marketing: { tracked: boolean }
  activity: ActivityItem[]
}

const PERIODS = ['24h', '7d', '30d', '90d', 'all'] as const
type Period = (typeof PERIODS)[number]

const PERIOD_LABELS: Record<Period, string> = { '24h': '24h', '7d': '7d', '30d': '30d', '90d': '90d', all: 'All' }
const PERIOD_DESC: Record<Period, string> = {
  '24h': 'the previous 24 hours',
  '7d': 'the previous 7 days',
  '30d': 'the previous 30 days',
  '90d': 'the previous 90 days',
  all: 'all time',
}

function pctChange(current: number, prior: number): number | null {
  if (prior === 0) return current > 0 ? null : 0
  return ((current - prior) / prior) * 100
}

export function AdminDashboardPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: sess } = await supabase.auth.getSession()
        const token = sess.session?.access_token
        if (!token) throw new Error('Not signed in')
        const res = await fetch(`/api/admin/dashboard-stats?period=${period}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(j.error || 'Failed to load dashboard')
        }
        const data = (await res.json()) as Stats
        if (!cancelled) setStats(data)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load dashboard')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [period])

  const liveAt = useMemo(() => {
    if (!stats) return ''
    return new Date(stats.generatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  }, [stats])

  return (
    <div>
      {/* Header row: title + period selector + live indicator */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className={admin.pageTitle}>Overview</h1>
        <div className="flex items-center gap-4">
          <div className="flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriod(p)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                  period === p ? 'bg-[#3A7AFE] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
          {stats && (
            <span className="hidden items-center gap-1.5 text-xs text-gray-500 sm:inline-flex">
              <span className="h-2 w-2 rounded-full bg-green-500" />
              Live as of {liveAt}
            </span>
          )}
        </div>
      </div>

      {loading && !stats ? (
        <p className={`${admin.contentTop} ${admin.loading}`}>Loading metrics…</p>
      ) : error ? (
        <p className={`${admin.contentTop} ${admin.error}`}>{error}</p>
      ) : stats ? (
        <div className={loading ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          {/* KPI cards */}
          <div className={`${admin.contentTop} grid gap-4 sm:grid-cols-2 xl:grid-cols-4`}>
            <KpiCard
              icon={<Zap className="h-4 w-4" />}
              title="Rental Value Reports"
              metric={stats.rentalReports}
              period={period}
              caption="Free Rental Value Reports completed (lead magnet)."
            />
            <KpiCard
              icon={<Home className="h-4 w-4" />}
              title="New Listings"
              metric={stats.newListings}
              period={period}
              caption={`New properties listed by landlords, vs. ${PERIOD_DESC[period]}.`}
              to="/admin/properties"
            />
            <KpiCard
              icon={<Users className="h-4 w-4" />}
              title="New Renters"
              metric={stats.newRenters}
              period={period}
              caption="New renter accounts created — people actively searching for a property."
              to="/admin/users?role=tenant"
            />
            <RevenueCard revenue={stats.revenue} />
          </div>

          {/* DAU strip */}
          <div className={`${admin.contentTop} ${admin.panel} flex flex-wrap items-center gap-x-10 gap-y-4 px-6 py-5`}>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Daily active users</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-300">—</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">7-day average</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-300">—</p>
            </div>
            <div className="min-w-[220px] flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Not tracked yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Daily active user tracking isn't enabled. It requires session analytics instrumentation.
              </p>
            </div>
          </div>

          {/* Marketing strip */}
          <div className={`${admin.contentTop} ${admin.panel} flex flex-wrap items-center gap-x-10 gap-y-4 px-6 py-5`}>
            {['Ad spend', 'Impressions', 'ROAS'].map((label) => (
              <div key={label}>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
                <p className="mt-1 text-2xl font-semibold tabular-nums text-gray-300">—</p>
              </div>
            ))}
            <div className="min-w-[220px] flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Not tracked yet</p>
              <p className="mt-1 text-xs text-gray-400">
                Marketing metrics activate once an ad platform (Google/Meta) is connected.
              </p>
            </div>
          </div>

          {/* Recent activity */}
          <div className={`${admin.contentTop} ${admin.panel}`}>
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-base font-semibold text-gray-900">Recent activity</h2>
              <Link to="/admin/users" className="text-sm font-medium text-[#3A7AFE] hover:underline">
                View all
              </Link>
            </div>
            {stats.activity.length === 0 ? (
              <p className="px-6 py-8 text-center text-sm text-gray-500">No activity yet.</p>
            ) : (
              <ul className="divide-y divide-gray-50">
                {stats.activity.map((a, i) => (
                  <li key={`${a.kind}-${a.at}-${i}`}>
                    <ActivityRow item={a} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Sparkline({ series, positive }: { series: number[]; positive: boolean }) {
  const w = 260
  const h = 44
  const max = Math.max(...series, 1)
  const step = w / Math.max(series.length - 1, 1)
  const points = series.map((v, i) => `${(i * step).toFixed(1)},${(h - 4 - (v / max) * (h - 8)).toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-11 w-full" preserveAspectRatio="none" aria-hidden>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? '#3A7AFE' : '#9CA3AF'}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

function TrendBadge({ current, prior }: { current: number; prior: number }) {
  const pct = pctChange(current, prior)
  if (pct === null) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700">
        <ArrowUpRight className="h-3 w-3" />
        New
      </span>
    )
  }
  const up = pct >= 0
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
        up ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {up ? '+' : ''}
      {pct.toFixed(1)}% vs prior period
    </span>
  )
}

function KpiCard({
  icon,
  title,
  metric,
  period,
  caption,
  to,
}: {
  icon: React.ReactNode
  title: string
  metric: Metric
  period: Period
  caption: string
  to?: string
}) {
  const body = (
    <>
      <div className="flex items-center gap-2 text-gray-500">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF4FE] text-[#3A7AFE]">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wide">{title}</span>
      </div>
      <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-gray-900">
        {metric.current.toLocaleString()}
      </p>
      <div className="mt-2">
        {period === 'all' ? (
          <span className="text-xs text-gray-400">All time</span>
        ) : (
          <TrendBadge current={metric.current} prior={metric.prior} />
        )}
      </div>
      <div className="mt-3 border-b border-gray-100 pb-3">
        <Sparkline series={metric.series} positive={metric.current >= metric.prior} />
      </div>
      <p className="mt-3 text-xs leading-5 text-gray-500">{caption}</p>
    </>
  )
  const cls = `${admin.panel} p-5 ${to ? 'transition hover:shadow-md' : ''}`
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

function RevenueCard({ revenue }: { revenue: Stats['revenue'] }) {
  return (
    <div className={`${admin.panel} p-5`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-500">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EEF4FE] text-[#3A7AFE]">
            <DollarSign className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide">Revenue / MRR</span>
        </div>
      </div>
      {revenue.billingEnabled ? (
        <>
          <p className="mt-3 text-4xl font-semibold tabular-nums tracking-tight text-gray-900">
            ${(revenue.currentCents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </p>
          <div className="mt-2">
            <TrendBadge current={revenue.currentCents} prior={revenue.priorCents} />
          </div>
          <p className="mt-3 text-xs leading-5 text-gray-500">Succeeded Stripe payments in the selected period.</p>
        </>
      ) : (
        <>
          <p className="mt-3 text-2xl font-semibold text-gray-400">Pre-revenue</p>
          <p className="mt-1 inline-block rounded-md bg-gray-50 px-2 py-1 text-xs text-gray-500">No payments yet</p>
          <div className="mt-4 h-1.5 rounded-full bg-gray-100" />
          <p className="mt-3 text-xs leading-5 text-gray-500">
            Revenue reporting activates automatically once the first payment succeeds. No figures are estimated.
          </p>
        </>
      )}
    </div>
  )
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d`
  return new Date(iso).toLocaleDateString()
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const icon =
    item.kind === 'listing' ? (
      <Home className="h-4 w-4 text-[#3A7AFE]" />
    ) : (
      <Users className="h-4 w-4 text-[#3A7AFE]" />
    )
  const inner = (
    <div className="flex items-center gap-3 px-6 py-3.5">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EEF4FE]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-gray-800">{item.label}</p>
        {item.sub ? <p className="truncate text-xs text-gray-400">{item.sub}</p> : null}
      </div>
      <span className="shrink-0 text-xs text-gray-400">{relTime(item.at)}</span>
    </div>
  )
  return item.href ? (
    <Link to={item.href} className="block transition hover:bg-gray-50">
      {inner}
    </Link>
  ) : (
    inner
  )
}
