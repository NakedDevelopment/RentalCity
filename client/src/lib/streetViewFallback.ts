import { useEffect, useState } from 'react'

export type FallbackAddressParts = {
  address_line1?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
}

export function buildFallbackAddress(parts: FallbackAddressParts): string {
  return [parts.address_line1, parts.city, parts.state, parts.postal_code].filter(Boolean).join(', ')
}

export function streetViewImageUrl(address: string): string {
  return `/api/street-view-image?addr=${encodeURIComponent(address)}`
}

/**
 * Checks whether Street View imagery exists for an address, only when the caller has
 * no real uploaded photos. Returns null while checking/unavailable so callers can fall
 * back to their own empty-state UI.
 */
export function useStreetViewFallback(address: string | null): string | null {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    setUrl(null)
    if (!address) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/street-view-check?addr=${encodeURIComponent(address)}`)
        const data = (await res.json().catch(() => null)) as { available?: boolean } | null
        if (!cancelled && data?.available) {
          setUrl(streetViewImageUrl(address))
        }
      } catch {
        // Fallback silently remains unavailable — caller shows its own empty state.
      }
    })()
    return () => {
      cancelled = true
    }
  }, [address])

  return url
}
