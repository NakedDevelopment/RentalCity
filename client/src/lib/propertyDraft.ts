export type PropertyDraftPhoto = {
  id: string
  label: string
  cover: boolean
  /** Object URL for preview; not persisted to draft */
  previewUrl?: string
  /** File for upload; kept in memory, not persisted */
  file?: File
}

export type PropertyDraft = {
  propertyName: string
  streetAddress: string
  city: string
  state: string
  zipCode: string
  monthlyRent: string
  securityDeposit: string
  leaseTerm: string
  communityDescription: string
  bedrooms: string
  bathrooms: string
  amenities: string[]
  photos: PropertyDraftPhoto[]
}

export const DEFAULT_PROPERTY_DRAFT: PropertyDraft = {
  propertyName: '',
  streetAddress: '',
  city: '',
  state: '',
  zipCode: '',
  monthlyRent: '',
  securityDeposit: '',
  leaseTerm: '',
  communityDescription: '',
  bedrooms: '',
  bathrooms: '',
  amenities: [],
  photos: [],
}

const STORAGE_KEY = 'rental-city-property-draft'

export function loadPropertyDraft(): PropertyDraft {
  if (typeof window === 'undefined') return DEFAULT_PROPERTY_DRAFT

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PROPERTY_DRAFT

    const parsed = JSON.parse(raw) as Partial<PropertyDraft>
    return {
      ...DEFAULT_PROPERTY_DRAFT,
      ...parsed,
      amenities: Array.isArray(parsed.amenities) ? parsed.amenities : [],
      photos: Array.isArray(parsed.photos) ? parsed.photos : [],
    }
  } catch {
    return DEFAULT_PROPERTY_DRAFT
  }
}

export function savePropertyDraft(draft: PropertyDraft) {
  if (typeof window === 'undefined') return
  const toPersist = {
    ...draft,
    photos: draft.photos.map(({ id, label, cover }) => ({ id, label, cover })),
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(toPersist))
}

export function clearPropertyDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(STORAGE_KEY)
}

export function moneyInputToCents(value: string) {
  const normalized = value.replace(/[^0-9.]/g, '')
  if (!normalized) return 0

  const amount = Number(normalized)
  if (Number.isNaN(amount)) return 0

  return Math.round(amount * 100)
}

export function centsToMoneyInput(value: number | null | undefined) {
  if (value == null) return ''
  return String(value / 100)
}

export function formatCurrency(cents: number | null | undefined) {
  const dollars = (cents ?? 0) / 100
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(dollars)
}

export function formatBedrooms(value: number | null | undefined) {
  if (value == null) return 'N/A'
  return value === 0 ? 'Studio' : `${value} bed`
}

export function formatBathrooms(value: number | string | null | undefined) {
  if (value == null || value === '') return 'N/A'
  return `${value} bath`
}
