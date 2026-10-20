import { supabase } from './supabase'

export type GeocodableAddress = {
  addressLine1: string
  addressLine2?: string | null
  city: string
  state?: string | null
  postalCode?: string | null
}

export function addressKey(a: GeocodableAddress): string {
  return [a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode]
    .map((p) => (p ?? '').trim().toLowerCase())
    .join('|')
}

/**
 * Calls the server-side /api/geocode proxy (keeps GOOGLE_MAPS_API_KEY off the client).
 * Never throws — failures are logged and resolve to null so callers can fire-and-forget.
 */
export async function geocodeAddress(address: GeocodableAddress): Promise<{ lat: number; lng: number } | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) return null
  try {
    const res = await fetch('/api/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
      }),
    })
    const j = (await res.json().catch(() => null)) as
      | { ok: true; lat: number; lng: number }
      | { ok: false; status: string; error_message?: string }
      | null
    if (j?.ok) return { lat: j.lat, lng: j.lng }
    console.error('Geocode request failed', j)
    return null
  } catch (err) {
    console.error('Geocode request failed', err instanceof Error ? err.message : String(err))
    return null
  }
}
