import { useEffect, useState } from 'react'
import { PropertyCard } from '../components/PropertyCard'
import { formatCurrency } from '../lib/propertyDraft'
import { supabase } from '../lib/supabase'

const PLACEHOLDER_IMAGES = [
  'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
]

function formatPostedAgo(createdAt: string) {
  const date = new Date(createdAt)
  const diffMs = Date.now() - date.getTime()
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffHours / 24)
  if (diffHours < 24) return `${diffHours}H ago`
  if (diffDays < 7) return `${diffDays}D ago`
  return date.toLocaleDateString()
}

export function HomePage() {
  const [properties, setProperties] = useState<
    Array<{
      id: string
      image: string
      perfectFit?: boolean
      postedAgo: string
      beds: number
      baths: number
      sqft: number
      price: string
      address: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [resultCount, setResultCount] = useState(0)

  useEffect(() => {
    async function loadProperties() {
      setLoading(true)
      setError(null)

      let query = supabase
        .from('properties')
        .select('id, address_line1, address_line2, city, state, postal_code, bedrooms, bathrooms, sqft, monthly_rent_cents, created_at, photo_labels')
        .eq('status', 'active')
        .order('created_at', { ascending: false })

      if (searchQuery.trim()) {
        const q = searchQuery.trim()
        const pattern = `%${q}%`
        query = query.or(`address_line1.ilike.${pattern},city.ilike.${pattern},state.ilike.${pattern}`)
      }

      const { data, error } = await query

      setLoading(false)
      if (error) {
        setError(error.message)
        return
      }

      const rows = data ?? []
      setResultCount(rows.length)
      setProperties(
        rows.map((p, i) => ({
          id: p.id,
          image: PLACEHOLDER_IMAGES[i % PLACEHOLDER_IMAGES.length],
          perfectFit: i < 2,
          postedAgo: formatPostedAgo(p.created_at),
          beds: p.bedrooms,
          baths: typeof p.bathrooms === 'number' ? p.bathrooms : Number(p.bathrooms) || 1,
          sqft: p.sqft ?? 0,
          price: formatCurrency(p.monthly_rent_cents),
          address: [p.address_line1, p.address_line2, p.city, p.state, p.postal_code].filter(Boolean).join(' '),
        })),
      )
    }

    loadProperties()
  }, [searchQuery])

  return (
    <div className="space-y-6">
      <p className="text-gray-600">
        <span className="font-semibold text-gray-900">{loading ? '...' : resultCount} Results</span>
        {' '}in New York, US
      </p>

      <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <label htmlFor="search" className="sr-only">
            Search by location
          </label>
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 0 0114 0z" />
            </svg>
            <input
              id="search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by location..."
              className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <select className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option>Any Price</option>
          </select>
          <select className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option>2-4 Beds</option>
          </select>
          <select className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option>All Types</option>
          </select>
          <button
            type="button"
            className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm font-medium hover:bg-gray-50"
          >
            More
          </button>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-600">Family mode</span>
            <button
              type="button"
              className="relative w-10 h-6 bg-emerald-600 rounded-full"
              aria-label="Family mode on"
            >
              <span className="absolute right-1 top-1 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg">
            <span className="text-sm text-gray-600">Map View</span>
            <button
              type="button"
              className="relative w-10 h-6 bg-gray-200 rounded-full"
              aria-label="Map view off"
            >
              <span className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full" />
            </button>
          </div>
          <select className="px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-700 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500">
            <option>Sort by: Newest</option>
          </select>
        </div>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-gray-500 py-8">Loading properties...</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((p) => (
            <PropertyCard
              key={p.id}
              id={p.id}
              image={p.image}
              perfectFit={p.perfectFit}
              postedAgo={p.postedAgo}
              beds={p.beds}
              baths={p.baths}
              sqft={p.sqft}
              price={p.price}
              address={p.address}
            />
          ))}
        </div>
      )}

      {!loading && properties.length === 0 ? (
        <p className="text-gray-500 py-8">No properties found. Try adjusting your search.</p>
      ) : null}
    </div>
  )
}
