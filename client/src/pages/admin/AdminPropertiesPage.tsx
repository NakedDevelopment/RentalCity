import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatCurrency } from '../../lib/propertyDraft'
import { fetchAdminDirectory, type AdminDirectoryUser } from '../../lib/adminApi'
import { PropertyCard } from '../../components/PropertyCard'
import { AdminPageHeader, AdminSearchInput, AdminLoadingBlock, AdminErrorBlock, admin } from './adminUi'

export const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
]

type PropertyRow = {
  id: string
  landlord_id: string
  address_line1: string
  city: string
  state: string | null
  bedrooms: number
  bathrooms: number | string
  sqft: number | null
  monthly_rent_cents: number
  status: string
  created_at: string
  photo_urls: string[] | null
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'draft' | 'leased'
type BedroomFilter = 'any' | '1' | '2' | '3' | '4+'
type SortOption = 'newest' | 'oldest' | 'rent_asc' | 'rent_desc'

export function AdminPropertiesPage() {
  const [searchParams] = useSearchParams()
  const statusParam = searchParams.get('status')
  const initialStatus: StatusFilter =
    statusParam === 'active' || statusParam === 'inactive' || statusParam === 'draft' || statusParam === 'leased'
      ? statusParam
      : 'all'

  const [rows, setRows] = useState<PropertyRow[]>([])
  const [landlords, setLandlords] = useState<Map<string, AdminDirectoryUser>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<StatusFilter>(initialStatus)
  const [bedrooms, setBedrooms] = useState<BedroomFilter>('any')
  const [minRent, setMinRent] = useState('')
  const [maxRent, setMaxRent] = useState('')
  const [sort, setSort] = useState<SortOption>('newest')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [propsRes, directory] = await Promise.all([
          supabase
            .from('properties')
            .select('id, landlord_id, address_line1, city, state, bedrooms, bathrooms, sqft, monthly_rent_cents, status, created_at, photo_urls')
            .order('created_at', { ascending: false }),
          fetchAdminDirectory(),
        ])
        if (cancelled) return
        if (propsRes.error) {
          setError(propsRes.error.message)
          setLoading(false)
          return
        }
        setRows((propsRes.data ?? []) as PropertyRow[])
        setLandlords(new Map(directory.map((u) => [u.id, u])))
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load properties')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const filtered = useMemo(() => {
    const min = minRent.trim() ? Number(minRent) * 100 : null
    const max = maxRent.trim() ? Number(maxRent) * 100 : null
    const q = search.trim().toLowerCase()

    let list = rows.filter((r) => {
      if (status !== 'all' && r.status !== status) return false
      if (bedrooms !== 'any') {
        const beds = r.bedrooms
        if (bedrooms === '4+' ? beds < 4 : beds !== Number(bedrooms)) return false
      }
      if (min != null && r.monthly_rent_cents < min) return false
      if (max != null && r.monthly_rent_cents > max) return false
      if (q) {
        const address = `${r.address_line1} ${r.city} ${r.state ?? ''}`.toLowerCase()
        if (!address.includes(q)) return false
      }
      return true
    })

    list = [...list].sort((a, b) => {
      switch (sort) {
        case 'oldest':
          return a.created_at.localeCompare(b.created_at)
        case 'rent_asc':
          return a.monthly_rent_cents - b.monthly_rent_cents
        case 'rent_desc':
          return b.monthly_rent_cents - a.monthly_rent_cents
        default:
          return b.created_at.localeCompare(a.created_at)
      }
    })

    return list
  }, [rows, status, bedrooms, minRent, maxRent, sort, search])

  return (
    <div>
      <AdminPageHeader title="Properties" description="All properties listed across the platform." />

      <div className={`${admin.contentTop} flex flex-wrap items-center gap-3`}>
        <AdminSearchInput
          id="properties-search"
          label="Search properties"
          value={search}
          onChange={setSearch}
          placeholder="Search by address or city…"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
          className={admin.btnChip}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="draft">Draft</option>
          <option value="leased">Leased</option>
        </select>
        <select
          value={bedrooms}
          onChange={(e) => setBedrooms(e.target.value as BedroomFilter)}
          className={admin.btnChip}
        >
          <option value="any">Any beds</option>
          <option value="1">1 bed</option>
          <option value="2">2 beds</option>
          <option value="3">3 beds</option>
          <option value="4+">4+ beds</option>
        </select>
        <input
          type="number"
          inputMode="numeric"
          placeholder="Min rent"
          value={minRent}
          onChange={(e) => setMinRent(e.target.value)}
          className={`${admin.btnChip} w-28`}
        />
        <input
          type="number"
          inputMode="numeric"
          placeholder="Max rent"
          value={maxRent}
          onChange={(e) => setMaxRent(e.target.value)}
          className={`${admin.btnChip} w-28`}
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className={admin.btnChip}
        >
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="rent_asc">Rent: low to high</option>
          <option value="rent_desc">Rent: high to low</option>
        </select>
      </div>

      {loading ? (
        <AdminLoadingBlock className={admin.contentTop} />
      ) : error ? (
        <AdminErrorBlock message={error} className={admin.contentTop} />
      ) : filtered.length === 0 ? (
        <div className={`${admin.contentTop} ${admin.emptyState}`}>No properties match these filters.</div>
      ) : (
        <div className={`${admin.contentTop} grid gap-5 sm:grid-cols-2 lg:grid-cols-3`}>
          {filtered.map((p, idx) => {
            const landlord = landlords.get(p.landlord_id)
            const address = [p.address_line1, p.city].filter(Boolean).join(', ')
            return (
              <Link key={p.id} to={`/admin/properties/${p.id}`} className="block space-y-2">
                <PropertyCard
                  image={p.photo_urls?.[0] ?? PLACEHOLDER_IMAGES[idx % PLACEHOLDER_IMAGES.length]}
                  beds={p.bedrooms}
                  baths={Number(p.bathrooms)}
                  sqft={p.sqft ?? 0}
                  price={`${formatCurrency(p.monthly_rent_cents)}/mo`}
                  address={address}
                />
                <div className="flex items-center justify-between px-1 text-xs text-gray-500">
                  <span>{landlord?.display_name ?? 'Unknown landlord'}</span>
                  <StatusBadge status={p.status} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'active'
      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
      : status === 'leased'
        ? 'bg-blue-50 text-blue-700 border-blue-200'
        : status === 'draft'
          ? 'bg-gray-100 text-gray-700 border-gray-200'
          : 'bg-amber-50 text-amber-900 border-amber-200'
  return (
    <span className={`rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${style}`}>{status}</span>
  )
}
