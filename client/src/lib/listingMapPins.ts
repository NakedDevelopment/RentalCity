import { validCoordinates } from '../../../shared/reportCoordinates'
import { matchScoreHex } from './matchScoreColor'

export type ListingPinSource = {
  id: string
  lat: unknown
  lng: unknown
  /** 0–100 match score. Missing scores stay uncolored as the lowest existing band. */
  matchScore?: number | null
  priceLabel: string
}

export type ListingPin = {
  id: string
  lat: number
  lng: number
  color: string
  priceLabel: string
  matchScore: number
  /** False when the listing has coordinates but no match score yet. */
  scoreKnown: boolean
}

/** One pin per listing that already has a valid coordinate pair. No geocoding. */
export function deriveListingPins(listings: ListingPinSource[]): ListingPin[] {
  const pins: ListingPin[] = []
  for (const listing of listings) {
    const coords = validCoordinates(listing.lat, listing.lng)
    if (!coords) continue
    const raw = listing.matchScore
    const scoreKnown = typeof raw === 'number' && Number.isFinite(raw)
    const matchScore = scoreKnown ? Math.min(100, Math.max(0, raw)) : 0
    pins.push({
      id: listing.id,
      lat: coords.lat,
      lng: coords.lng,
      color: matchScoreHex(matchScore),
      priceLabel: listing.priceLabel,
      matchScore,
      scoreKnown,
    })
  }
  return pins
}

export function formatBedsBaths(bedrooms: number, bathrooms: number, separator: '|' | '·'): string {
  const beds = bedrooms === 0 ? 'Studio' : `${bedrooms} bd`
  const baths = Number.isFinite(bathrooms) ? bathrooms : 0
  const bathText = Number.isInteger(baths) ? String(baths) : String(baths)
  return `${beds} ${separator} ${bathText} ba`
}
