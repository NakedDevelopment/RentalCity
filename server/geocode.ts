import { validCoordinates } from '../shared/reportCoordinates'

export type AddressParts = {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

export function buildAddressString(parts: AddressParts): string {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.state, parts.postalCode]
    .map((part) => part?.trim()).filter(Boolean).join(', ')
}

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; status: string; error_message?: string }

// Normalize postal abbreviations, not street numbers or distinct street names.
const abbreviations: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr',
  lane: 'ln', court: 'ct', circle: 'cir', place: 'pl', terrace: 'ter',
  parkway: 'pkwy', highway: 'hwy', trail: 'trl', north: 'n', south: 's',
  east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
}
const normalize = (value: unknown) => typeof value === 'string'
  ? value.toLowerCase().replace(/[.,]/g, '').trim().split(/\s+/)
    .map((word) => abbreviations[word] ?? word).join(' ')
  : ''

/** Never use a nearby result or a different property's coordinates. */
export function isSameProperty(address: AddressParts, record: Record<string, unknown>): boolean {
  if (!normalize(address.addressLine1) || normalize(address.addressLine1) !== normalize(record.addressLine1)) return false
  if (address.state?.trim() && normalize(address.state) !== normalize(record.state)) return false
  const zip = address.postalCode?.trim().slice(0, 5)
  if (zip) {
    if (zip !== String(record.zipCode ?? '').slice(0, 5)) return false
  } else if (address.city?.trim() && normalize(address.city) !== normalize(record.city)) return false
  // Building-level coordinates are valid for a unit; a different returned unit is not.
  if (address.addressLine2?.trim() && record.addressLine2 &&
    normalize(address.addressLine2) !== normalize(record.addressLine2)) return false
  return true
}

/** RentCast property records only. No Google calls or approximate property fallback. */
export async function geocodeAddress(address: AddressParts, apiKey: string | undefined): Promise<GeocodeResult> {
  if (!apiKey) return { ok: false, status: 'missing_key', error_message: 'RentCast location lookup is not configured.' }
  if (!address.addressLine1?.trim() || !/\d/.test(address.addressLine1) ||
    (!address.postalCode?.trim() && (!address.city?.trim() || !address.state?.trim()))) {
    return { ok: false, status: 'invalid_request', error_message: 'Provide a street address and city/state or ZIP code.' }
  }
  // Units do not affect a building's location and can prevent a parcel record match.
  const query = new URLSearchParams({
    address: buildAddressString({ ...address, addressLine2: null }),
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
    const matching = data.filter((record) => record && typeof record === 'object' && isSameProperty(address, record))
    for (const record of matching) {
      const coords = validCoordinates(record.latitude, record.longitude)
      if (coords) return { ok: true, ...coords }
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
    if (result.ok || result.status === 'no_exact_match') {
      if (cache.size >= 2000) cache.delete(cache.keys().next().value!)
      cache.set(key, { result, expires: Date.now() + (result.ok ? 86400000 : 300000) })
    }
    return result
  }).finally(() => pending.delete(key))
  pending.set(key, request)
  return request
}
