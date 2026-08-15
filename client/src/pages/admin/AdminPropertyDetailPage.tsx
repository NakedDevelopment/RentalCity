import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { formatBedrooms, formatBathrooms, formatCurrency } from '../../lib/propertyDraft'
import { fetchAdminDirectory, updatePropertyStatus, type AdminDirectoryUser, type PropertyStatus } from '../../lib/adminApi'
import { AdminLoadingBlock, AdminErrorBlock, admin } from './adminUi'
import { StatusBadge } from './AdminPropertiesPage'

type PropertyDetail = {
  id: string
  landlord_id: string
  title: string
  location: string
  price: string
  beds: string
  baths: string
  sqft: string
  description: string
  status: string
  created_at: string
  amenities: string[]
  photoUrls: string[]
  photoLabels: string[]
}

export function AdminPropertyDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [property, setProperty] = useState<PropertyDetail | null>(null)
  const [landlord, setLandlord] = useState<AdminDirectoryUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activePhotoIdx, setActivePhotoIdx] = useState(0)
  const [savingStatus, setSavingStatus] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  async function handleStatusChange(next: PropertyStatus) {
    if (!property || next === property.status) return
    if (next === 'leased') {
      const confirmed = window.confirm(
        'Marking this property as Leased will automatically reject all pending applications for it. Continue?',
      )
      if (!confirmed) return
    }
    setSavingStatus(true)
    setStatusError(null)
    try {
      const saved = await updatePropertyStatus(property.id, next)
      setProperty({ ...property, status: saved })
    } catch (e) {
      setStatusError(e instanceof Error ? e.message : 'Failed to update status')
    } finally {
      setSavingStatus(false)
    }
  }

  useEffect(() => {
    if (!id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        const [{ data, error: err }, directory] = await Promise.all([
          supabase
            .from('properties')
            .select(
              'id, landlord_id, address_line1, title, city, state, bedrooms, bathrooms, sqft, monthly_rent_cents, description, status, created_at, amenities, photo_urls, photo_labels',
            )
            .eq('id', id)
            .maybeSingle(),
          fetchAdminDirectory(),
        ])
        if (cancelled) return
        if (err) {
          setError(err.message)
          setLoading(false)
          return
        }
        if (!data) {
          setError('Property not found')
          setLoading(false)
          return
        }
        const row = data as {
          id: string
          landlord_id: string
          address_line1: string
          title: string | null
          city: string
          state: string | null
          bedrooms: number
          bathrooms: number | string
          sqft: number | null
          monthly_rent_cents: number
          description: string | null
          status: string
          created_at: string
          amenities: string[] | null
          photo_urls: string[] | null
          photo_labels: string[] | null
        }
        setLandlord(directory.find((u) => u.id === row.landlord_id) ?? null)
        setActivePhotoIdx(0)
        setProperty({
          id: row.id,
          landlord_id: row.landlord_id,
          title: row.title || row.address_line1,
          location: [row.city, row.state].filter(Boolean).join(', '),
          price: `${formatCurrency(row.monthly_rent_cents)}/month`,
          beds: formatBedrooms(row.bedrooms),
          baths: formatBathrooms(row.bathrooms),
          sqft: row.sqft ? `${row.sqft} sq ft` : '',
          description: row.description || 'No description available.',
          status: row.status,
          created_at: row.created_at,
          amenities: Array.isArray(row.amenities) ? row.amenities : [],
          photoUrls: Array.isArray(row.photo_urls) ? row.photo_urls.filter(Boolean) : [],
          photoLabels: Array.isArray(row.photo_labels) ? row.photo_labels : [],
        })
        setLoading(false)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load property')
          setLoading(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return <AdminLoadingBlock />
  }
  if (error || !property) {
    return (
      <div className="space-y-4">
        <Link to="/admin/properties" className={admin.textLink}>
          ← Properties
        </Link>
        <AdminErrorBlock message={error ?? 'Property not found'} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Link to="/admin/properties" className={admin.textLink}>
        ← Properties
      </Link>

      <div className={`${admin.panelPaddedLg} flex flex-wrap items-center justify-between gap-3`}>
        <div className="flex items-center gap-3">
          <StatusBadge status={property.status} />
          <span className={admin.muted}>
            Landlord:{' '}
            {landlord ? (
              <Link to={`/admin/users/${landlord.id}`} className="font-medium text-gray-900 hover:underline">
                {landlord.display_name ?? landlord.email}
              </Link>
            ) : (
              'Unknown'
            )}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            Status
            <select
              value={property.status}
              disabled={savingStatus}
              onChange={(e) => void handleStatusChange(e.target.value as PropertyStatus)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:opacity-60"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="leased">Leased</option>
            </select>
          </label>
          <span className={admin.muted}>Created {new Date(property.created_at).toLocaleDateString()}</span>
        </div>
      </div>
      {statusError ? <AdminErrorBlock message={statusError} /> : null}

      <div className="overflow-hidden rounded-xl bg-gray-100 aspect-[16/8]">
        {property.photoUrls.length > 0 ? (
          <img
            src={property.photoUrls[activePhotoIdx] ?? property.photoUrls[0]}
            alt={property.photoLabels[activePhotoIdx] || 'Property photo'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-500">No photos yet</div>
        )}
      </div>

      {property.photoUrls.length > 1 ? (
        <div className="grid grid-cols-5 gap-2">
          {property.photoUrls.slice(0, 5).map((url, idx) => (
            <button
              key={`${url}-${idx}`}
              type="button"
              onClick={() => setActivePhotoIdx(idx)}
              className={`aspect-[6/3.5] overflow-hidden rounded-lg bg-gray-100 transition ${
                idx === activePhotoIdx ? 'ring-2 ring-blue-500 ring-offset-1' : 'hover:opacity-85'
              }`}
            >
              <img src={url} alt={property.photoLabels[idx] || `Photo ${idx + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      ) : null}

      <div className={admin.panelPaddedLg}>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{property.title}</h1>
        {property.location ? <p className="mt-1 text-sm text-gray-600">{property.location}</p> : null}
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm text-gray-700">
          <span className="text-xl font-semibold text-gray-900">{property.price}</span>
          <span>{property.beds}</span>
          <span>{property.baths}</span>
          {property.sqft ? <span>{property.sqft}</span> : null}
        </div>
      </div>

      <div className={admin.panelPaddedLg}>
        <h2 className={admin.detailTitle}>Description</h2>
        <p className="mt-3 text-sm leading-6 text-gray-700">{property.description}</p>
      </div>

      {property.amenities.length > 0 ? (
        <div className={admin.panelPaddedLg}>
          <h2 className={admin.detailTitle}>Amenities</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {property.amenities.map((a) => (
              <p key={a} className="text-sm text-gray-700">
                {a}
              </p>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
