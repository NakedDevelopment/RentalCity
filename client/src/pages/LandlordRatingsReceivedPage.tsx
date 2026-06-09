import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { TenantAvatar } from '../components/TenantAvatar'
import { formatTenantReviewDate, ReviewStarsReadOnly } from '../components/TenantReviewDisplay'
import { safeInternalPath } from '../lib/safeInternalPath'
import { supabase } from '../lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type Row = {
  id: string
  rating: number
  comment: string | null
  property_name: string | null
  property_address: string | null
  created_at: string
  tenant_external_id: string
  tenant_name: string | null
  tenant_id: string | null
  tenant?: { display_name: string | null; avatar_url: string | null } | null
}

function normalizeTenantEmbeds(row: Row): Row {
  const t = row.tenant
  const tenant = Array.isArray(t) ? t[0] ?? null : t ?? null
  return { ...row, tenant }
}

function RatingListItem({ row }: { row: Row }) {
  const displayName = row.tenant?.display_name?.trim() || row.tenant_name?.trim() || 'Tenant'
  const avatarUrl = row.tenant?.avatar_url ?? null
  const propertyLine = row.property_name?.trim() || row.property_address?.trim() || 'Listing'

  return (
    <li className="rounded-lg border border-gray-100 bg-gray-50/80 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <TenantAvatar name={displayName} avatarUrl={avatarUrl} sizeClass="h-12 w-12" textClass="text-xs" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">{displayName}</p>
            <p className="mt-0.5 text-xs text-gray-500">{propertyLine}</p>
            <p className="mt-1 text-xs text-gray-500">{formatTenantReviewDate(row.created_at)}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <ReviewStarsReadOnly value={row.rating} />
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-gray-700">
        {row.comment?.trim() || <span className="text-gray-400">No written comment.</span>}
      </p>
    </li>
  )
}

export function LandlordRatingsReceivedPage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = safeInternalPath(searchParams.get('returnTo')) ?? `/matches/landlord/${encodeURIComponent(id)}`

  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const landlordId = useMemo(() => (UUID_RE.test(id) ? id : null), [id])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!landlordId) {
        setError('Invalid landlord id.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError(null)
      const { data, error: loadErr } = await supabase
        .from('tenant_ratings')
        .select(
          'id, rating, comment, property_name, property_address, created_at, tenant_external_id, tenant_name, tenant_id, tenant:tenant_id(display_name, avatar_url)',
        )
        .eq('landlord_id', landlordId)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (loadErr) {
        setError(loadErr.message)
        setRows([])
      } else {
        setRows(((data ?? []) as unknown as Row[]).map(normalizeTenantEmbeds))
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [landlordId])

  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <Link
        to={returnTo}
        className="mb-6 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </Link>

      <h1 className="text-[1.6rem] font-medium text-gray-900">Ratings they&apos;ve given</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-500">
        All tenant ratings and comments this landlord has submitted.
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">No tenant ratings yet.</p>
      ) : (
        <section className="mt-8 rounded-xl border border-gray-200 bg-white p-5">
          <ul className="space-y-4">
            {rows.map((row) => (
              <RatingListItem key={row.id} row={row} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

