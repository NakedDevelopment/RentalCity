import { validCoordinates } from '../shared/reportCoordinates'
import { isSameProperty, parseStreet, propertyConflict, type PropertyAddress } from './propertyAddress'
export { isSameProperty } from './propertyAddress'
export type AddressParts = PropertyAddress

export function buildAddressString(parts: AddressParts): string {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.state, parts.postalCode]
    .map((part) => part?.trim()).filter(Boolean).join(', ')
}

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; status: string; error_message?: string; candidates?: LocationCandidate[] }

export type LocationCandidate = {
  street: string; unit: string; city: string; state: string; zip: string
  reason: string; hasCoordinates: boolean
}

/** RentCast property records only. No Google calls or approximate property fallback. */
export async function geocodeAddress(address: AddressParts, apiKey: string | undefined): Promise<GeocodeResult> {
  if (!apiKey) return { ok: false, status: 'missing_key', error_message: 'RentCast location lookup is not configured.' }
  if (!address.addressLine1?.trim() || !/\d/.test(address.addressLine1) ||
    (!address.postalCode?.trim() && (!address.city?.trim() || !address.state?.trim()))) {
    return { ok: false, status: 'invalid_request', error_message: 'Provide a street address and city/state or ZIP code.' }
  }
  const parsed = parseStreet(address.addressLine1, address.addressLine2)
  if (parsed.unitConflict) return { ok: false, status: 'review_required', error_message: 'The address contains conflicting unit numbers.' }
  // Units do not affect a building's location and can prevent a parcel record match.
  const query = new URLSearchParams({
    address: buildAddressString({ ...address, addressLine1: parsed.street, addressLine2: null }),
    limit: '5',
  })
  try {
    const res = await fetch(`https://api.rentcast.io/v1/properties?${query}`, {
      headers: { accept: 'application/json', 'X-Api-Key': apiKey },
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) {
      if (res.status === 404) return { ok: false, status: 'no_exact_match', error_message: 'No exact property location was found in RentCast.' }
      if (res.status === 400) return { ok: false, status: 'invalid_request', error_message: 'RentCast could not recognize that property address.' }
      return { ok: false, status: `provider_${res.status}`, error_message:
        res.status === 429 ? 'Location lookup limit reached. Please try again later.' : 'RentCast property lookup is unavailable.' }
    }
    const data: unknown = await res.json().catch(() => null)
    if (!Array.isArray(data)) return { ok: false, status: 'invalid_response' }
    const records = data.filter((record): record is Record<string, unknown> =>
      Boolean(record && typeof record === 'object' && !Array.isArray(record))).slice(0, 5)
    const matching = records.filter((record) => isSameProperty(address, record))
    const locations = matching.flatMap((record) => {
      const coords = validCoordinates(record.latitude, record.longitude)
      return coords ? [coords] : []
    })
    const uniqueLocations = new Set(locations.map((coords) => `${coords.lat},${coords.lng}`))
    const uniqueAddresses = new Set(matching.map((record) => {
      const street = parseStreet(record.addressLine1)
      return JSON.stringify([street.house, street.name, street.pre, street.post, street.suffix, record.state, record.zipCode])
    }))
    const ambiguous = uniqueLocations.size > 1 || uniqueAddresses.size > 1
    if (uniqueLocations.size === 1 && !ambiguous && locations.length === matching.length) return { ok: true, ...locations[0] }
    const string = (value: unknown) => typeof value === 'string' ? value : ''
    const candidates: LocationCandidate[] = records.map((record) => ({
      street: string(record.addressLine1), unit: string(record.addressLine2),
      city: string(record.city), state: string(record.state), zip: string(record.zipCode),
      reason: propertyConflict(address, record) ?? (ambiguous ? 'ambiguous_match' : 'missing_coordinates'),
      hasCoordinates: Boolean(validCoordinates(record.latitude, record.longitude)),
    }))
    if (records.length) {
      return { ok: false, status: 'review_required', error_message:
        ambiguous ? 'Multiple property locations match. Please review the address.' :
          'The returned property address needs review before its location can be used.', candidates }
    }
    return { ok: false, status: 'no_exact_match', error_message: 'No exact property location was found in RentCast.' }
  } catch {
    // Never expose upstream URLs, credentials, or private addresses through errors.
    return { ok: false, status: 'request_failed', error_message: 'Location lookup could not complete. Please try again.' }
  }
}

// Bounded, expiring cache prevents repeated billable requests on repeated saves.
const cache = new Map<string, { expires: number; result: GeocodeResult }>()
const pending = new Map<string, Promise<GeocodeResult>>()
export async function lookupPropertyLocation(address: AddressParts, apiKey: string | undefined): Promise<GeocodeResult> {
  const key = JSON.stringify([address.addressLine1, address.addressLine2, address.city, address.state, address.postalCode]
    .map((value) => value?.trim().toLowerCase() ?? ''))
  const cached = cache.get(key)
  if (cached && cached.expires > Date.now()) return cached.result
  if (pending.has(key)) return pending.get(key)!
  const request = geocodeAddress(address, apiKey).then((result) => {
    if (result.ok || result.status === 'no_exact_match' || result.status === 'review_required') {
      if (cache.size >= 2000) cache.delete(cache.keys().next().value!)
      cache.set(key, { result, expires: Date.now() + (result.ok ? 86400000 : 300000) })
    }
    return result
  }).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
