export type Coordinates = { lat: number; lng: number }

/** Reject missing, partial, non-numeric, and out-of-range coordinate pairs. */
export function validCoordinates(lat: unknown, lng: unknown): Coordinates | null {
  const parse = (value: unknown) =>
    typeof value === 'number' ? value :
      typeof value === 'string' && value.trim() ? Number(value) : NaN
  const latitude = parse(lat)
  const longitude = parse(lng)
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    Number.isFinite(longitude) && Math.abs(longitude) <= 180
    ? { lat: latitude, lng: longitude } : null
}

/** Use only the subject property, never a comparable's location. */
export function rentCastCoordinates(subject: unknown, property?: unknown): Coordinates | null {
  for (const record of [subject, property]) {
    if (record && typeof record === 'object') {
      const p = record as Record<string, unknown>
      const coords = validCoordinates(p.latitude, p.longitude)
      if (coords) return coords
    }
  }
  return null
}

type ReportAddress = { streetAddress: string; city: string; state: string; zipCode: string }

/** Coordinates belong to the report address, not a subsequently edited address. */
export function coordinatesForReportAddress(
  report: (ReportAddress & { lat?: unknown; lng?: unknown }) | null,
  current: ReportAddress,
): Coordinates | null {
  if (!report) return null
  const normalize = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  for (const field of ['streetAddress', 'city', 'state', 'zipCode'] as const) {
    if (normalize(report[field]) !== normalize(current[field])) return null
  }
  return validCoordinates(report.lat, report.lng)
}
