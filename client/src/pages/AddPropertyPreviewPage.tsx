import { useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  clearPropertyDraft,
  formatCurrency,
  loadPropertyDraft,
  moneyInputToCents,
  type PropertyDraftPhoto,
} from '../lib/propertyDraft'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const PROPERTY_IMAGES_BUCKET = 'property-images'

const AMENITY_LABELS: Record<string, string> = {
  pet_friendly: 'Pet Friendly',
  parking: 'Parking',
  laundry: 'Laundry',
  gym: 'Gym',
  balcony: 'Balcony',
  yard: 'Yard',
}

function formatAmenityLabel(label: string): string {
  if (AMENITY_LABELS[label]) return AMENITY_LABELS[label]
  // Fallback: turn snake_case into Title Case
  const normalized = label.replace(/_/g, ' ')
  return normalized.replace(/\b\w/g, (ch) => ch.toUpperCase())
}

function AmenityItem({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-gray-800">
      <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
      </svg>
      <span>{formatAmenityLabel(label)}</span>
    </div>
  )
}

export function AddPropertyPreviewPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const draft = loadPropertyDraft()
  const photosFromState = (location.state as { photos?: PropertyDraftPhoto[] })?.photos
  const displayPhotos = photosFromState && photosFromState.length > 0 ? photosFromState : draft.photos
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const monthlyRentCents = useMemo(() => moneyInputToCents(draft.monthlyRent), [draft.monthlyRent])
  const customDepositCents = useMemo(
    () => (draft.securityDeposit.trim() ? moneyInputToCents(draft.securityDeposit) : null),
    [draft.securityDeposit],
  )
  const depositCents = customDepositCents ?? monthlyRentCents
  const depositLabel =
    customDepositCents != null
      ? formatCurrency(customDepositCents)
      : `${formatCurrency(monthlyRentCents)} (1 month)`
  const bedroomCount = draft.bedrooms === 'studio' ? 0 : Number.parseInt(draft.bedrooms || '0', 10)
  const bathroomCount = Number.parseFloat(draft.bathrooms || '0')
  const propertyType =
    draft.bedrooms === 'studio'
      ? 'Studio Apartment'
      : `${draft.bedrooms || '0'} Bedroom Apartment`

  const leaseTerms = [
    { label: 'Lease Duration', value: draft.leaseTerm ? `${draft.leaseTerm} months` : 'N/A' },
    { label: 'Security Deposit', value: depositLabel },
    { label: 'Available Date', value: 'Available immediately' },
  ]

  async function persistProperty(status: 'draft' | 'active') {
    setError(null)

    if (!user) {
      setError('You must be signed in to save a property.')
      return
    }

    if (!draft.streetAddress || !draft.city || !draft.state || !draft.zipCode || !draft.monthlyRent) {
      setError('Please complete the basic info step before continuing.')
      return
    }

    if (!draft.bedrooms || !draft.bathrooms) {
      setError('Please complete the amenities step before continuing.')
      return
    }

    setSubmitting(true)

    const photosToUse = photosFromState && photosFromState.length > 0 ? photosFromState : draft.photos
    if (status === 'active' && photosToUse.length === 0) {
      setError('To publish, add at least one property photo.')
      setSubmitting(false)
      return
    }
    const photoLabels = photosToUse.map((p) => p.label)
    let photoUrls: string[] = []

    if (photosToUse.some((p) => p.file)) {
      const uploadFolderId = crypto.randomUUID()
      for (let i = 0; i < photosToUse.length; i++) {
        const photo = photosToUse[i]
        if (!photo.file) continue
        const ext = photo.file.name.split('.').pop()?.toLowerCase() || 'jpg'
        const path = `${user.id}/${uploadFolderId}/${i}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from(PROPERTY_IMAGES_BUCKET)
          .upload(path, photo.file, { upsert: true })
        if (uploadError) {
          setError(uploadError.message)
          setSubmitting(false)
          return
        }
        const { data: urlData } = supabase.storage.from(PROPERTY_IMAGES_BUCKET).getPublicUrl(path)
        photoUrls.push(urlData.publicUrl)
      }
    }
    if (status === 'active' && photoUrls.length === 0) {
      setError('To publish, upload at least one property photo.')
      setSubmitting(false)
      return
    }

    const { data, error: insertError } = await supabase
      .from('properties')
      .insert({
        landlord_id: user.id,
        title: draft.propertyName || null,
        address_line1: draft.streetAddress,
        city: draft.city,
        state: draft.state,
        postal_code: draft.zipCode,
        bedrooms: Number.isNaN(bedroomCount) ? 0 : bedroomCount,
        bathrooms: Number.isNaN(bathroomCount) ? 0 : bathroomCount,
        monthly_rent_cents: monthlyRentCents,
        deposit_cents: depositCents,
        application_fee_cents: 5000,
        description: draft.communityDescription || null,
        lease_term: draft.leaseTerm ? `${draft.leaseTerm} months` : null,
        amenities: draft.amenities,
        photo_labels: photoLabels,
        photo_urls: photoUrls,
        status,
      })
      .select('id')
      .single()

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    clearPropertyDraft()

    if (status === 'draft') {
      navigate('/properties')
      return
    }

    navigate(`/properties/published?id=${data.id}`)
  }

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto max-w-[620px]">
        <Link
          to="/onboarding/property/photos"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
          <h1 className="text-[2rem] font-medium text-gray-900">Preview Your Property</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">Review your details before publishing.</p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>Step 4 of 4</span>
              <span>100% Complete</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 w-full rounded-full bg-gray-900" />
            </div>
          </div>

          <section className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Property Photos</h2>
              <Link to="/onboarding/property/photos" className="text-sm text-gray-500 underline hover:text-gray-700">
                Edit
              </Link>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-4">
              {displayPhotos.map((photo, index) => (
                <div
                  key={photo.id}
                  className={`flex items-center justify-center overflow-hidden rounded-lg bg-gray-300 ${
                    index === 0 ? 'h-[210px] sm:col-span-2 sm:row-span-2' : 'h-[96px]'
                  }`}
                >
                  {photo.previewUrl ? (
                    <img
                      src={photo.previewUrl}
                      alt={photo.label}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-sm text-white">{photo.label}</span>
                  )}
                </div>
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-gray-100 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Property Details</h2>
              <Link to="/onboarding/property/basic-info" className="text-sm text-gray-500 underline hover:text-gray-700">
                Edit
              </Link>
            </div>

            <div className="mt-5 grid gap-8 sm:grid-cols-2">
              <div>
                <h3 className="text-lg font-medium text-gray-900">Basic Information</h3>
                <div className="mt-4 space-y-4 text-sm text-gray-700">
                  <div>
                    <p className="text-gray-500">Address</p>
                    <p className="mt-1">
                      {draft.streetAddress}, {draft.city}, {draft.state} {draft.zipCode}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Monthly Rent</p>
                    <p className="mt-1 text-[2rem] font-medium leading-none text-gray-900">
                      {formatCurrency(monthlyRentCents)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Property Type</p>
                    <p className="mt-1">{propertyType}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Square Footage</p>
                    <p className="mt-1">To be added later</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-medium text-gray-900">Description</h3>
                <p className="mt-4 text-sm leading-7 text-gray-700">
                  {draft.communityDescription || 'No community description added yet.'}
                </p>
              </div>
            </div>
          </section>

          <section className="mt-8 border-t border-gray-100 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Amenities</h2>
              <Link to="/onboarding/property/amenities" className="text-sm text-gray-500 underline hover:text-gray-700">
                Edit
              </Link>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-3">
              {draft.amenities.map((amenity) => (
                <AmenityItem key={amenity} label={amenity} />
              ))}
            </div>
          </section>

          <section className="mt-8 border-t border-gray-100 pt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Lease Terms</h2>
              <Link to="/onboarding/property/basic-info" className="text-sm text-gray-500 underline hover:text-gray-700">
                Edit
              </Link>
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-3">
              {leaseTerms.map((term) => (
                <div key={term.label}>
                  <p className="text-sm text-gray-500">{term.label}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{term.value}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            disabled={submitting}
            onClick={() => persistProperty('draft')}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {submitting ? 'Saving...' : 'Save as Draft'}
          </button>

          <button
            type="button"
            disabled={submitting}
            onClick={() => persistProperty('active')}
            className="inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-3 text-sm font-medium text-white"
          >
            {submitting ? 'Publishing...' : 'Publish Property'}
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm leading-6 text-gray-700">
              <span className="font-medium text-gray-900">Need help?</span> Make sure your address is accurate as this will be used for tenant searches and background verification.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
