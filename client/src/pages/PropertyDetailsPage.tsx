import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Waves,
  Car,
  WashingMachine,
  Snowflake,
  Sofa,
  PawPrint,
  Dumbbell,
  Fence,
  Utensils,
  Layers,
  Wifi,
  Flame,
  Trees,
  Check,
  type LucideIcon,
} from 'lucide-react'
import { formatBedrooms, formatBathrooms, formatCurrency } from '../lib/propertyDraft'
import { supabase } from '../lib/supabase'

type PropertyDetails = {
  id: string
  title: string
  price: string
  beds: string
  baths: string
  sqft: string
  description: string
  landlordName: string
  amenities: string[]
  leaseDetails: Array<{ label: string; value: string }>
  photoUrls: string[]
  photoLabels: string[]
}

const AMENITY_LABELS: Record<string, string> = {
  pet_friendly: 'Pet Friendly',
  parking: 'Parking',
  laundry: 'Laundry',
  gym: 'Gym',
  balcony: 'Balcony',
  yard: 'Yard',
}

function mapAmenities(amenities: string[] | null | undefined): string[] {
  if (!Array.isArray(amenities)) return []
  return amenities.map((a) => AMENITY_LABELS[a] ?? String(a)).filter(Boolean)
}

function Stat({
  icon,
  label,
}: {
  icon: React.ReactNode
  label: string
}) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
      {icon}
      {label}
    </span>
  )
}

function getAmenityIcon(amenity: string): LucideIcon {
  const a = amenity.toLowerCase()
  if (a.includes('pool')) return Waves
  if (a.includes('parking') || a.includes('garage')) return Car
  if (a.includes('washer') || a.includes('dryer') || a.includes('laundry')) return WashingMachine
  if (a.includes('air condition') || a.includes('a/c') || a.includes('cooling') || a.includes('conditioning'))
    return Snowflake
  if (a.includes('furnished') || a.includes('furniture')) return Sofa
  if (a.includes('pet')) return PawPrint
  if (a.includes('gym') || a.includes('fitness')) return Dumbbell
  if (a.includes('balcony') || a.includes('patio') || a.includes('deck')) return Fence
  if (a.includes('yard') || a.includes('garden') || a.includes('outdoor')) return Trees
  if (a.includes('dishwasher') || a.includes('kitchen')) return Utensils
  if (a.includes('floor') || a.includes('hardwood')) return Layers
  if (a.includes('wifi') || a.includes('internet')) return Wifi
  if (a.includes('fireplace') || a.includes('heat')) return Flame
  return Check
}

function AmenityItem({ label }: { label: string }) {
  const Icon = getAmenityIcon(label)
  return (
    <div className="flex items-center gap-3 text-sm text-gray-700">
      <Icon className="h-5 w-5 shrink-0 text-gray-400" strokeWidth={2} />
      <span className="leading-5">{label}</span>
    </div>
  )
}

function formatDate(date: string | null | undefined): string {
  if (!date) return 'Contact landlord'
  const d = new Date(date)
  return `Available ${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
}

export function PropertyDetailsPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const fromMatches = searchParams.get('from') === 'matches'
  const [property, setProperty] = useState<PropertyDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadProperty() {
      if (!id) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('properties')
        .select(`
          id,
          address_line1,
          title,
          city,
          state,
          bedrooms,
          bathrooms,
          sqft,
          monthly_rent_cents,
          description,
          deposit_cents,
          application_fee_cents,
          available_from,
          lease_term,
          amenities,
          photo_urls,
          photo_labels,
          landlord:profiles(display_name)
        `)
        .eq('id', id)
        .eq('status', 'active')
        .maybeSingle()

      setLoading(false)

      if (err) {
        setError(err.message)
        return
      }

      if (!data) {
        setError('Property not found')
        return
      }

      const row = data as {
        id: string
        address_line1?: string
        title?: string
        city?: string
        state?: string
        bedrooms?: number
        bathrooms?: number | string
        sqft?: number
        monthly_rent_cents?: number
        description?: string
        deposit_cents?: number
        application_fee_cents?: number
        available_from?: string
        lease_term?: string
        amenities?: string[]
        photo_urls?: string[] | null
        photo_labels?: string[] | null
        landlord?: { display_name?: string } | null
      }

      const title = row.title || row.address_line1 || 'Property'
      const beds = formatBedrooms(row.bedrooms ?? 0)
      const baths = formatBathrooms(row.bathrooms)
      const sqft = row.sqft ? `${row.sqft} sq ft` : ''
      const price = row.monthly_rent_cents != null ? `${formatCurrency(row.monthly_rent_cents)}/month` : '—'
      const amenities = mapAmenities(row.amenities)

      const leaseDetails: Array<{ label: string; value: string }> = []
      if (row.lease_term) leaseDetails.push({ label: 'Lease Length', value: row.lease_term })
      leaseDetails.push({ label: 'Move-in Availability', value: formatDate(row.available_from) })
      if (row.deposit_cents != null) {
        leaseDetails.push({ label: 'Security Deposit', value: formatCurrency(row.deposit_cents) })
      } else if (row.monthly_rent_cents != null) {
        leaseDetails.push({ label: 'Security Deposit', value: `${formatCurrency(row.monthly_rent_cents)} (1 month rent)` })
      }
      if (row.application_fee_cents != null) {
        leaseDetails.push({ label: 'Application Fee', value: formatCurrency(row.application_fee_cents) })
      } else {
        leaseDetails.push({ label: 'Application Fee', value: '$50' })
      }

      const photoUrls = Array.isArray(row.photo_urls) ? row.photo_urls.map((u) => String(u)).filter(Boolean) : []
      const photoLabels = Array.isArray(row.photo_labels) ? row.photo_labels.map((l) => String(l)) : []

      setProperty({
        id: row.id,
        title,
        price,
        beds,
        baths,
        sqft,
        description: row.description || 'No description available.',
        landlordName: row.landlord?.display_name ?? 'Landlord',
        amenities: amenities.length > 0 ? amenities : ['See listing for details'],
        leaseDetails,
        photoUrls,
        photoLabels,
      })
    }

    loadProperty()
  }, [id])

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="py-8 text-sm text-gray-500">Loading property...</p>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="space-y-6">
        <Link to={fromMatches ? '/matches' : '/'} className="text-sm text-gray-600 hover:text-gray-900">
          ← {fromMatches ? 'Back to Matches' : 'Back to Browse Rentals'}
        </Link>
        <p className="py-8 text-sm text-red-600">{error ?? 'Property not found'}</p>
      </div>
    )
  }

  function PropertyHeroPhoto({
    url,
    alt,
  }: {
    url: string | null
    alt: string
  }) {
    const [broken, setBroken] = useState(false)
    const show = Boolean(url) && !broken
    return (
      <div className="overflow-hidden rounded-xl bg-gray-100 aspect-[16/8]">
        {show ? (
          <img
            src={url as string}
            alt={alt}
            className="h-full w-full object-cover"
            loading="eager"
            onError={() => setBroken(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <span className="text-lg text-gray-500">No photos yet</span>
          </div>
        )}
      </div>
    )
  }

  function PropertyThumb({ url, alt }: { url: string; alt: string }) {
    const [broken, setBroken] = useState(false)
    if (broken) return null
    return (
      <div className="aspect-[6/3.5] overflow-hidden rounded-lg bg-gray-100">
        <img
          src={url}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div>
            <nav className="mb-3 flex items-center gap-2 text-sm text-gray-500">
              <Link to={fromMatches ? '/matches' : '/'} className="hover:text-gray-900">
                {fromMatches ? 'Matches' : 'Browse Rentals'}
              </Link>
              <span>/</span>
              <span className="text-gray-700">Property Details</span>
            </nav>
            <h1 className="text-[2.1rem] font-medium text-gray-900">{property.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-[2rem] font-medium text-gray-900">{property.price}</span>
              <Stat
                label={property.beds}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10m0-6h18m0 0v6m0-6a2 2 0 00-2-2h-4a2 2 0 00-2 2m8 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2m8 0V9a2 2 0 00-2-2H5a2 2 0 00-2 2v2" />
                  </svg>
                }
              />
              <Stat
                label={property.baths}
                icon={
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 10V7a5 5 0 0110 0v3m-5 0v11m-7-5h14" />
                  </svg>
                }
              />
              {property.sqft ? <Stat label={property.sqft} icon={<span className="text-sm">•</span>} /> : null}
            </div>
          </div>

          <PropertyHeroPhoto
            url={property.photoUrls[0] ?? null}
            alt={property.photoLabels[0] || 'Main property photo'}
          />

          {property.photoUrls.length > 1 ? (
            <div className="grid grid-cols-5 gap-2">
              {property.photoUrls.slice(0, 5).map((url, idx) => (
                <PropertyThumb
                  key={`${url}-${idx}`}
                  url={url}
                  alt={property.photoLabels[idx] || `Property photo ${idx + 1}`}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          <aside className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className="mb-4 text-[1.75rem] font-medium text-gray-900">Landlord</h2>
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-gray-700">
                <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.761 0 5-2.686 5-6S14.761 0 12 0 7 2.686 7 6s2.239 6 5 6zm0 2c-4.418 0-8 2.686-8 6v2h16v-2c0-3.314-3.582-6-8-6z" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="font-medium text-gray-900">{property.landlordName}</p>
                <p className="mt-1 text-sm text-gray-500">Property Owner</p>
              </div>
            </div>
          </aside>

          <div className="space-y-2">
            <Link
              to={`/applications/apply?propertyId=${property.id}`}
              className="flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-3 text-sm font-medium text-white"
            >
              Apply Now
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <Link
              to="/messages"
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Message Landlord
            </Link>
          </div>

          <aside className="rounded-xl border border-gray-200 bg-white p-4">
            <h3 className="mb-4 text-sm font-medium text-gray-900">Lease Details</h3>
            <div className="space-y-3 text-sm">
              {property.leaseDetails.map((detail) => (
                <div key={detail.label} className="flex items-center justify-between gap-4">
                  <span className="text-gray-500">{detail.label}</span>
                  <span className="text-right text-gray-900">{detail.value}</span>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-[1.75rem] font-medium text-gray-900">Description</h2>
        <p className="text-base leading-8 text-gray-700">{property.description}</p>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="mb-5 text-[1.75rem] font-medium text-gray-900">Amenities</h2>
        <div className="grid gap-y-5 sm:grid-cols-2">
          {property.amenities.map((amenity) => (
            <AmenityItem key={amenity} label={amenity} />
          ))}
        </div>
      </section>

    </div>
  )
}
