import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { TenantAvatar } from './TenantAvatar'
import { formatTenantReviewDate, ReviewStarsReadOnly } from './TenantReviewDisplay'
import { supabase } from '../lib/supabase'

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

export function LandlordRatingsGivenPublicCard({
  landlordId,
  maxPreviewItems = 2,
  className = '',
}: {
  landlordId: string
  maxPreviewItems?: number | null
  className?: string
}) {
  const location = useLocation()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const returnTo = useMemo(() => `${location.pathname}${location.search}`, [location.pathname, location.search])

  const limit = maxPreviewItems == null ? null : maxPreviewItems
  const displayedRows = useMemo(() => (limit != null ? rows.slice(0, limit) : rows), [rows, limit])
  const hasMore = limit != null && rows.length > limit

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setLoadError(null)
      const { data, error } = await supabase
        .from('tenant_ratings')
        .select(
          'id, rating, comment, property_name, property_address, created_at, tenant_external_id, tenant_name, tenant_id, tenant:tenant_id(display_name, avatar_url)',
        )
        .eq('landlord_id', landlordId)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (error) {
        setLoadError(error.message)
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
    <section className={`rounded-xl border border-gray-200 bg-white p-5 ${className}`.trim()}>
      <h2 className="mb-1 text-sm font-medium text-gray-900">Ratings they&apos;ve given</h2>
      <p className="mb-4 text-xs leading-5 text-gray-500">
        Recent tenant ratings and comments this landlord has submitted.
      </p>

      {loadError ? (
        <p className="text-sm text-red-600">{loadError}</p>
      ) : loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-600">No tenant ratings yet.</p>
      ) : (
        <>
          <ul className="space-y-4">
            {displayedRows.map((row) => (
              <RatingListItem key={row.id} row={row} />
            ))}
          </ul>
          {hasMore ? (
            <div className="mt-5 border-t border-gray-100 pt-4">
              <Link
                to={`/matches/landlord/${encodeURIComponent(landlordId)}/ratings?${new URLSearchParams({
                  returnTo,
                }).toString()}`}
                className="text-sm font-medium text-gray-900 underline decoration-gray-400 underline-offset-2 hover:decoration-gray-600"
              >
                See all {rows.length} ratings
              </Link>
            </div>
          ) : null}
        </>
      )}
    </section>
  )
}

