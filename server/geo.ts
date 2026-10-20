import { validCoordinates, type Coordinates } from '../shared/reportCoordinates'

/** Choose a complete valid location pair, never latitude and longitude from different sources. */
export function firstKnownLocation(...locations: Array<{ lat?: unknown; lng?: unknown } | null | undefined>): Coordinates | null {
  for (const location of locations) {
    const coords = validCoordinates(location?.lat, location?.lng)
    if (coords) return coords
  }
  return null
}

/** Great-circle distance between two lat/lng points, in miles. Pure, no PostGIS/RPC needed. */
export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  const bounded = Math.min(1, Math.max(0, a))
  return R * 2 * Math.atan2(Math.sqrt(bounded), Math.sqrt(1 - bounded))
}

export const DEFAULT_MATCH_RADIUS_MILES = 50
