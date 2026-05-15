import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { centsToMoneyInput, formatCurrency, moneyInputToCents } from '../lib/propertyDraft'
import { useAuth } from '../lib/useAuth'
import { safeInternalPath } from '../lib/safeInternalPath'
import { supabase } from '../lib/supabase'

type ListingStatus = 'Active' | 'Draft' | 'Inactive' | 'Leased'

const LEASE_TERM_OPTIONS = [
  '',
  'Month-to-month',
  '3 months',
  '6 months',
  '12 months',
  '18 months',
  '24 months',
] as const

const LISTING_STATUS_OPTIONS: ListingStatus[] = ['Draft', 'Active', 'Inactive', 'Leased']

type PropertyRecord = {
  id: string
  title: string | null
  address_line1: string
  city: string
  state: string | null
  postal_code: string | null
  description: string | null
  bedrooms: number
  bathrooms: number
  sqft: number | null
  monthly_rent_cents: number
  deposit_cents: number | null
  application_fee_cents: number | null
  available_from: string | null
  lease_term: string | null
  status: 'draft' | 'active' | 'inactive' | 'leased'
  amenities: string[]
  photo_labels: string[]
  photo_urls: string[]
}

const PROPERTY_IMAGES_BUCKET = 'property-images'
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/heic']
const MAX_SIZE_BYTES = 10 * 1024 * 1024

type PhotoItem = {
  id: string
  label: string
  url?: string
  file?: File
  previewUrl?: string
}

const DEFAULT_AMENITIES = [
  'Air Conditioning',
  'Heating',
  'Parking',
  'Pet Friendly',
  'Washer/Dryer',
  'Dishwasher',
  'Pool',
  'Gym',
  'Balcony',
  'Hardwood Floors',
]

/** `input type="date"` only accepts YYYY-MM-DD; DB may return ISO timestamps. */
function toDateInputValue(raw: string | null | undefined): string {
  if (!raw?.trim()) return ''
  const t = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const m = t.match(/^(\d{4}-\d{2}-\d{2})/)
  return m?.[1] ?? ''
}

function InfoPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-5">
      <h2 className="text-[1.45rem] font-medium text-gray-900">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  )
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <label className="mb-2 block text-sm text-gray-700">{label}</label>
      <input
        readOnly
        value={value}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900"
      />
    </div>
  )
}

export function LandlordPropertyDetailsPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const { id = '1' } = useParams()
  const [searchParams] = useSearchParams()
  const isEditMode = searchParams.get('mode') === 'edit'

  const returnToPath = useMemo(
    () => safeInternalPath((location.state as { from?: string } | null)?.from),
    [location.state],
  )
  const backHref = returnToPath ?? '/properties'
  const backLabel = useMemo(() => {
    if (!returnToPath) return 'Back to Properties'
    if (returnToPath === '/properties' || returnToPath.startsWith('/properties?')) return 'Back to Properties'
    if (returnToPath.startsWith('/matches')) return 'Back to Matches'
    return 'Back'
  }, [returnToPath])

  const [property, setProperty] = useState<PropertyRecord | null>(null)
  const [formState, setFormState] = useState({
    title: '',
    addressLine1: '',
    neighborhood: '',
    stateCode: '',
    zipCode: '',
    description: '',
    bedrooms: '',
    bathrooms: '',
    squareFeet: '',
    monthlyRent: '',
    securityDeposit: '',
    applicationFee: '',
    availableFrom: '',
    leaseTerm: '',
    listingStatus: 'Draft' as ListingStatus,
  })
  const [amenities, setAmenities] = useState<Array<{ label: string; enabled: boolean }>>([])
  const [photoItems, setPhotoItems] = useState<PhotoItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const landlordId = user?.id

  const hydrateFromRecord = useCallback((normalized: PropertyRecord) => {
    setProperty(normalized)
    setFormState({
      title: normalized.title || normalized.address_line1,
      addressLine1: normalized.address_line1,
      neighborhood: normalized.city,
      stateCode: normalized.state ?? '',
      zipCode: normalized.postal_code ?? '',
      description: normalized.description ?? '',
      bedrooms: String(normalized.bedrooms),
      bathrooms: String(normalized.bathrooms),
      squareFeet: normalized.sqft ? String(normalized.sqft) : '',
      monthlyRent: centsToMoneyInput(normalized.monthly_rent_cents),
      securityDeposit: centsToMoneyInput(normalized.deposit_cents),
      applicationFee: centsToMoneyInput(normalized.application_fee_cents),
      availableFrom: toDateInputValue(normalized.available_from),
      leaseTerm: normalized.lease_term ?? '',
      listingStatus:
        normalized.status === 'draft'
          ? 'Draft'
          : normalized.status === 'inactive'
            ? 'Inactive'
            : normalized.status === 'leased'
              ? 'Leased'
              : 'Active',
    })
    setAmenities(
      DEFAULT_AMENITIES.map((label) => ({
        label,
        enabled: normalized.amenities.includes(label),
      })),
    )
    const labels = normalized.photo_labels.length > 0 ? normalized.photo_labels : ['Main Image']
    const urls = normalized.photo_urls ?? []
    setPhotoItems(
      labels.map((label, i) => ({
        id: `photo-${i}-${label}`,
        label,
        url: urls[i],
      })),
    )
  }, [])

  useEffect(() => {
    async function loadProperty() {
      if (!landlordId) {
        setLoading(false)
        setProperty(null)
        return
      }

      // Depend on landlordId, not `user`: Supabase replaces the User object on TOKEN_REFRESHED.
      // Re-running would setLoading(true), unmount the form, and re-hydrate — clicks/edits feel dead.
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('properties')
        .select(
          'id, title, address_line1, city, state, postal_code, description, bedrooms, bathrooms, sqft, monthly_rent_cents, deposit_cents, application_fee_cents, available_from, lease_term, status, amenities, photo_labels, photo_urls',
        )
        .eq('id', id)
        .eq('landlord_id', landlordId)
        .maybeSingle()

      setLoading(false)

      if (fetchError) {
        setError(fetchError.message)
        return
      }

      if (!data) {
        setError('Property not found.')
        return
      }

      const normalized = {
        ...data,
        amenities: data.amenities ?? [],
        photo_labels: data.photo_labels ?? [],
        photo_urls: data.photo_urls ?? [],
      } as PropertyRecord

      hydrateFromRecord(normalized)
    }

    loadProperty()
  }, [id, landlordId, hydrateFromRecord])

  function updateField<K extends keyof typeof formState>(key: K, value: (typeof formState)[K]) {
    setFormState((current) => ({ ...current, [key]: value }))
  }

  function toggleAmenity(label: string) {
    setAmenities((current) =>
      current.map((amenity) =>
        amenity.label === label ? { ...amenity, enabled: !amenity.enabled } : amenity,
      ),
    )
  }

  function makeCover(index: number) {
    setPhotoItems((current) => {
      const selected = current[index]
      const rest = current.filter((_, i) => i !== index)
      return [selected, ...rest]
    })
  }

  function removePhoto(index: number) {
    setPhotoItems((current) => {
      const item = current[index]
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl)
      return current.filter((_, i) => i !== index)
    })
  }

  function processFiles(files: FileList | null) {
    if (!files?.length) return
    const accepted: PhotoItem[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const isAccepted =
        ACCEPTED_TYPES.includes(file.type) ||
        file.type === 'image/heic' ||
        file.name.toLowerCase().endsWith('.heic')
      if (!isAccepted || file.size > MAX_SIZE_BYTES) continue
      accepted.push({
        id: `new-${Date.now()}-${i}`,
        label: file.name.replace(/\.[^/.]+$/, '') || `Photo ${photoItems.length + accepted.length + 1}`,
        file,
        previewUrl: URL.createObjectURL(file),
      })
    }
    if (accepted.length > 0) setPhotoItems((current) => [...current, ...accepted])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
    processFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    e.stopPropagation()
  }

  const photoItemsRef = useRef(photoItems)
  photoItemsRef.current = photoItems
  useEffect(() => {
    return () => {
      photoItemsRef.current.forEach((p) => p.previewUrl && URL.revokeObjectURL(p.previewUrl))
    }
  }, [])

  const moveInCost = useMemo(() => {
    const total =
      moneyInputToCents(formState.monthlyRent) +
      moneyInputToCents(formState.securityDeposit) +
      moneyInputToCents(formState.applicationFee)
    return formatCurrency(total)
  }, [formState.applicationFee, formState.monthlyRent, formState.securityDeposit])

  async function persistProperty(statusOverride?: 'draft' | 'active' | 'inactive' | 'leased') {
    if (!property || !user) return

    setSaving(true)
    setError(null)

    const status =
      statusOverride ??
      (formState.listingStatus.toLowerCase() as 'draft' | 'active' | 'inactive' | 'leased')

    if (status === 'active') {
      const requiredMissing =
        !formState.addressLine1.trim() ||
        !formState.neighborhood.trim() ||
        !formState.stateCode.trim() ||
        !formState.zipCode.trim() ||
        !formState.monthlyRent.trim() ||
        !formState.bedrooms.trim() ||
        !formState.bathrooms.trim()
      const hasAnyPhoto = photoItems.some((p) => Boolean(p.url || p.file))

      if (requiredMissing) {
        setError('To publish, complete address, rent, beds, and baths.')
        setSaving(false)
        return
      }
      if (!hasAnyPhoto) {
        setError('To publish, add at least one property photo.')
        setSaving(false)
        return
      }
    }

    const photoLabels = photoItems.map((p) => p.label)
    const photoUrls: string[] = []

    const hasNewUploads = photoItems.some((p) => p.file)
    if (hasNewUploads) {
      const uploadFolderId = crypto.randomUUID()
      for (let i = 0; i < photoItems.length; i++) {
        const item = photoItems[i]
        if (item.url) {
          photoUrls.push(item.url)
        } else if (item.file) {
          const ext = item.file.name.split('.').pop()?.toLowerCase() || 'jpg'
          const path = `${user.id}/${property.id}/${uploadFolderId}/${i}.${ext}`
          const { error: uploadError } = await supabase.storage
            .from(PROPERTY_IMAGES_BUCKET)
            .upload(path, item.file, { upsert: true })
          if (uploadError) {
            setError(uploadError.message)
            setSaving(false)
            return
          }
          const { data: urlData } = supabase.storage
            .from(PROPERTY_IMAGES_BUCKET)
            .getPublicUrl(path)
          photoUrls.push(urlData.publicUrl)
        }
      }
    } else {
      photoItems.forEach((p) => p.url && photoUrls.push(p.url))
    }

    const { error } = await supabase
      .from('properties')
      .update({
        title: formState.title || null,
        address_line1: formState.addressLine1,
        city: formState.neighborhood,
        state: formState.stateCode || null,
        postal_code: formState.zipCode || null,
        description: formState.description || null,
        bedrooms: Number.parseInt(formState.bedrooms || '0', 10),
        bathrooms: Number.parseFloat(formState.bathrooms || '0'),
        sqft: formState.squareFeet ? Number.parseInt(formState.squareFeet, 10) : null,
        monthly_rent_cents: moneyInputToCents(formState.monthlyRent),
        deposit_cents: moneyInputToCents(formState.securityDeposit),
        application_fee_cents: moneyInputToCents(formState.applicationFee),
        available_from: formState.availableFrom || null,
        lease_term: formState.leaseTerm || null,
        status,
        amenities: amenities.filter((amenity) => amenity.enabled).map((amenity) => amenity.label),
        photo_labels: photoLabels,
        photo_urls: photoUrls,
      })
      .eq('id', property.id)

    setSaving(false)

    if (error) {
      setError(error.message)
      return
    }

    const { data: refreshed } = await supabase
      .from('properties')
      .select(
        'id, title, address_line1, city, state, postal_code, description, bedrooms, bathrooms, sqft, monthly_rent_cents, deposit_cents, application_fee_cents, available_from, lease_term, status, amenities, photo_labels, photo_urls',
      )
      .eq('id', property.id)
      .eq('landlord_id', user.id)
      .maybeSingle()

    if (refreshed) {
      hydrateFromRecord({
        ...refreshed,
        amenities: refreshed.amenities ?? [],
        photo_labels: refreshed.photo_labels ?? [],
        photo_urls: refreshed.photo_urls ?? [],
      } as PropertyRecord)
    }

    navigate({ pathname: `/properties/${property.id}`, search: '' }, { replace: true, state: location.state })
  }

  if (loading) {
    return <div className="py-8 text-sm text-gray-500">Loading property...</div>
  }

  if (!property) {
    return (
      <div className="space-y-6">
        <p className="text-sm text-red-600">{error ?? 'Property not found.'}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col py-8">
      <div>
        <Link to={backHref} className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {backLabel}
        </Link>

        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[2rem] font-medium text-gray-900">{isEditMode ? 'Edit Property' : 'View Property'}</h1>
            <p className="mt-2 text-sm text-gray-600">
              {isEditMode
                ? 'Update your property details to attract the right tenants'
                : 'Update your listing details and make it active again'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isEditMode ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    if (!property) return
                    hydrateFromRecord(property)
                    setError(null)
                    navigate({ pathname: `/properties/${property.id}`, search: '' }, { replace: true, state: location.state })
                  }}
                  className="inline-flex min-w-[96px] items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => persistProperty()}
                  className="inline-flex min-w-[112px] items-center justify-center rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </>
            ) : (
              <Link
                to={{ pathname: `/properties/${property.id}`, search: '?mode=edit' }}
                state={location.state}
                className="inline-flex min-w-[108px] items-center justify-center rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white"
              >
                Edit Property
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-5">
          <InfoPanel title="Basic Information">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-gray-700">Property Name</label>
                <input
                  readOnly={!isEditMode}
                  value={formState.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-700">Address</label>
                <input
                  readOnly={!isEditMode}
                  value={formState.addressLine1}
                  onChange={(e) => updateField('addressLine1', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  readOnly={!isEditMode}
                  value={formState.neighborhood}
                  onChange={(e) => updateField('neighborhood', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
                <input
                  readOnly={!isEditMode}
                  value={formState.stateCode}
                  onChange={(e) => updateField('stateCode', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
                <input
                  readOnly={!isEditMode}
                  value={formState.zipCode}
                  onChange={(e) => updateField('zipCode', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-700">Description</label>
                <textarea
                  readOnly={!isEditMode}
                  value={formState.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  className={`min-h-[124px] w-full rounded-lg border border-gray-200 px-4 py-3 text-sm leading-7 text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-2 block text-sm text-gray-700">Bedrooms</label>
                  <input
                    readOnly={!isEditMode}
                    value={formState.bedrooms}
                    onChange={(e) => updateField('bedrooms', e.target.value)}
                    className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                      isEditMode ? 'bg-white' : 'bg-gray-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-700">Bathrooms</label>
                  <input
                    readOnly={!isEditMode}
                    value={formState.bathrooms}
                    onChange={(e) => updateField('bathrooms', e.target.value)}
                    className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                      isEditMode ? 'bg-white' : 'bg-gray-50'
                    }`}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm text-gray-700">Square Feet</label>
                  <input
                    readOnly={!isEditMode}
                    value={formState.squareFeet}
                    onChange={(e) => updateField('squareFeet', e.target.value)}
                    className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                      isEditMode ? 'bg-white' : 'bg-gray-50'
                    }`}
                  />
                </div>
              </div>
            </div>
          </InfoPanel>

          <InfoPanel title="Amenities">
            <div className="grid gap-y-4 sm:grid-cols-2">
              {amenities.map((amenity) => (
                <label key={amenity.label} className="flex items-center gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={amenity.enabled}
                    disabled={!isEditMode}
                    onChange={() => (isEditMode ? toggleAmenity(amenity.label) : undefined)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                  />
                  <span>{amenity.label}</span>
                </label>
              ))}
            </div>
          </InfoPanel>

          <InfoPanel title={isEditMode ? 'Property Images' : 'Property Photos'}>
            <div
              role="button"
              tabIndex={0}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => (isEditMode ? fileInputRef.current?.click() : undefined)}
              onKeyDown={(e) => (isEditMode && e.key === 'Enter' ? fileInputRef.current?.click() : undefined)}
              className={`mb-4 rounded-xl border border-dashed border-gray-300 py-8 text-center transition-colors ${
                isEditMode ? 'cursor-pointer bg-gray-50 hover:border-gray-400 hover:bg-gray-100' : 'bg-gray-50'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,image/jpeg,image/png,image/heic"
                multiple
                className="hidden"
                disabled={!isEditMode}
                onChange={(e) => {
                  processFiles(e.target.files)
                  e.target.value = ''
                }}
              />
              <svg className="mx-auto h-10 w-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="mt-2 text-sm font-medium text-gray-700">
                {isEditMode ? 'Drag and drop photos or click to browse' : 'Photos'}
              </p>
              {isEditMode ? <p className="mt-1 text-xs text-gray-500">JPG, PNG, HEIC (max 10MB each)</p> : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {photoItems.map((item, index) => (
                <div
                  key={item.id}
                  className="relative flex aspect-[5/3] items-center justify-center overflow-hidden rounded-xl bg-gray-300"
                >
                  {isEditMode ? (
                    <>
                      <button
                        type="button"
                        onClick={() => makeCover(index)}
                        className={`absolute left-2 top-2 z-10 rounded-md px-2 py-1 text-[10px] font-medium ${
                          index === 0 ? 'bg-gray-900 text-white' : 'bg-white/85 text-gray-700'
                        }`}
                      >
                        {index === 0 ? 'Cover' : 'Make Cover'}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePhoto(index)}
                        className="absolute right-2 top-2 z-10 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black"
                        aria-label={`Remove ${item.label}`}
                      >
                        <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  ) : null}
                  {(item.url || item.previewUrl) ? (
                    <img
                      src={item.url || item.previewUrl}
                      alt={item.label}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs text-white/90">{item.label}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm text-gray-500">
              Upload at least 5 high-quality images. First image will be the primary photo.
            </p>
          </InfoPanel>
        </div>

        <div className="space-y-5">
          <InfoPanel title="Pricing">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-gray-700">Monthly Rent</label>
                <input
                  readOnly={!isEditMode}
                  value={formState.monthlyRent}
                  onChange={(e) => updateField('monthlyRent', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-700">Security Deposit</label>
                <input
                  readOnly={!isEditMode}
                  value={formState.securityDeposit}
                  onChange={(e) => updateField('securityDeposit', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>
              <div>
                <label className="mb-2 block text-sm text-gray-700">Application Fee</label>
                <input
                  readOnly={!isEditMode}
                  value={formState.applicationFee}
                  onChange={(e) => updateField('applicationFee', e.target.value)}
                  className={`w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 ${
                    isEditMode ? 'bg-white' : 'bg-gray-50'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm">
                <span className="text-gray-500">Move-in Cost</span>
                <span className="font-medium text-gray-900">{moveInCost}</span>
              </div>
            </div>
          </InfoPanel>

          <InfoPanel title="Availability">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-gray-700" htmlFor="property-available-from">
                  Available From
                </label>
                {isEditMode ? (
                  <input
                    id="property-available-from"
                    type="date"
                    value={formState.availableFrom}
                    onChange={(e) => updateField('availableFrom', e.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
                  />
                ) : (
                  <ReadonlyField label="" value={formState.availableFrom} />
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-700" htmlFor="property-lease-term">
                  Lease Term
                </label>
                {isEditMode ? (
                  <select
                    id="property-lease-term"
                    value={formState.leaseTerm}
                    onChange={(e) => updateField('leaseTerm', e.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
                  >
                    {LEASE_TERM_OPTIONS.map((opt) => (
                      <option key={opt || '__empty'} value={opt}>
                        {opt || 'Select a lease term'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ReadonlyField label="" value={formState.leaseTerm} />
                )}
              </div>
            </div>
          </InfoPanel>

          <InfoPanel title="Status">
            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm text-gray-700" htmlFor="property-listing-status">
                  Listing Status
                </label>
                {isEditMode ? (
                  <select
                    id="property-listing-status"
                    value={formState.listingStatus}
                    onChange={(e) => updateField('listingStatus', e.target.value as ListingStatus)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900"
                  >
                    {LISTING_STATUS_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                ) : (
                  <ReadonlyField label="" value={formState.listingStatus} />
                )}
              </div>

              <div className="rounded-xl bg-gray-50 px-4 py-4">
                <div className="flex items-start gap-2.5">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-gray-800">Listing Completion</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      Your listing is complete and ready to find tenants.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </InfoPanel>

          <div className="rounded-xl bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-2.5">
              <svg className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-800">Relisting Tips</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">
                  Update your photos and description to attract quality tenants. Consider adjusting rent
                  based on market conditions.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {error ? <p className="mt-5 text-sm text-red-600">{error}</p> : null}

    </div>
  )
}
