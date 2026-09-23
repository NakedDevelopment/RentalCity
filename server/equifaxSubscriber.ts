export type SubscriberAddressInput = {
  street?: unknown
  unit?: unknown
  city?: unknown
  state?: unknown
  zip?: unknown
}

export type EquifaxSubscriberInput = {
  businessName?: unknown
  phone?: unknown
  address?: SubscriberAddressInput | unknown
}

export function normalizeEquifaxSubscriberDetails(input: EquifaxSubscriberInput | null): {
  businessName: string
  businessPhone: string
  businessAddress: string
} | null {
  const businessName = typeof input?.businessName === 'string' ? input.businessName.trim() : ''
  const rawPhone = typeof input?.phone === 'string' ? input.phone.trim() : ''
  const digits = rawPhone.replace(/\D/g, '')
  const phoneDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  const address = input?.address && typeof input.address === 'object' && !Array.isArray(input.address)
    ? input.address as SubscriberAddressInput
    : null
  const clean = (value: unknown) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  const street = clean(address?.street)
  const unit = clean(address?.unit)
  const city = clean(address?.city)
  const state = clean(address?.state).toUpperCase()
  const zip = clean(address?.zip)
  const businessAddress = `${street}${unit ? `, ${unit}` : ''}, ${city}, ${state} ${zip}`

  if (!businessName || businessName.length > 60 ||
      !/^[+()\d\s.-]{10,25}$/.test(rawPhone) || phoneDigits.length !== 10 ||
      street.length < 3 || street.length > 60 || unit.length > 25 ||
      !city || city.length > 45 || !/^[A-Z]{2}$/.test(state) ||
      !/^\d{5}(?:-\d{4})?$/.test(zip) || businessAddress.length > 85) return null

  return {
    businessName,
    businessPhone: `(${phoneDigits.slice(0, 3)}) ${phoneDigits.slice(3, 6)}-${phoneDigits.slice(6)}`,
    businessAddress,
  }
}