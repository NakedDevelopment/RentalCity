const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json'

export function buildAddressString(parts: {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}): string {
  return [parts.addressLine1, parts.addressLine2, parts.city, parts.state, parts.postalCode]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join(', ')
}

export type GeocodeResult =
  | { ok: true; lat: number; lng: number }
  | { ok: false; status: string; error_message?: string }

/**
 * Calls the Google Maps Geocoding API for a free-form address.
 * Never throws — all failure modes (missing key, API error, network failure)
 * resolve to an { ok: false } result so callers can log and move on.
 */
export async function geocodeAddress(address: string, apiKey: string | undefined): Promise<GeocodeResult> {
  if (!apiKey) return { ok: false, status: 'missing_key', error_message: 'GOOGLE_MAPS_API_KEY not configured' }
  if (!address || !address.trim()) return { ok: false, status: 'invalid_request', error_message: 'Empty address' }

  const url = `${GEOCODE_URL}?address=${encodeURIComponent(address)}&key=${encodeURIComponent(apiKey)}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = (await res.json().catch(() => null)) as {
      status?: string
      error_message?: string
      results?: Array<{ geometry?: { location?: { lat: number; lng: number } } }>
    } | null
    if (!data) return { ok: false, status: 'invalid_response' }
    if (data.status !== 'OK') return { ok: false, status: data.status ?? 'unknown_error', error_message: data.error_message }
    const loc = data.results?.[0]?.geometry?.location
    if (!loc) return { ok: false, status: 'no_results' }
    return { ok: true, lat: loc.lat, lng: loc.lng }
  } catch (err) {
    return { ok: false, status: 'request_failed', error_message: err instanceof Error ? err.message : String(err) }
  }
}
