import zipcodes from 'zipcodes'
import { validCoordinates } from '../shared/reportCoordinates'

type LocationResult =
  | { ok: true; lat: number; lng: number; label: string; approximate: true }
  | { ok: false; status: string; error_message: string }

const normalize = (value: string) => value.toLowerCase().replace(/[.]/g, '').replace(/\s+/g, ' ').trim()
const cities = new Map<string, Map<string, zipcodes.ZipCode[]>>()
for (const record of Object.values(zipcodes.codes)) {
  if (record.country !== 'US' || !validCoordinates(record.latitude, record.longitude) ||
    (record.latitude === 0 && record.longitude === 0)) continue
  const city = normalize(record.city)
  if (!cities.has(city)) cities.set(city, new Map())
  const states = cities.get(city)!
  if (!states.has(record.state)) states.set(record.state, [])
  states.get(record.state)!.push(record)
}

/** Offline US city/ZIP centers. No provider key, paid requests, or property lookups. */
export function searchLocation(query: string): LocationResult {
  const value = query.trim()
  const zip = value.match(/^(\d{5})(?:-\d{4})?$/)?.[1]
  if (zip) {
    const record = zipcodes.lookup(zip)
    if (record?.country === 'US' && validCoordinates(record.latitude, record.longitude) &&
      (record.latitude !== 0 || record.longitude !== 0)) {
      return { ok: true, lat: record.latitude, lng: record.longitude,
        label: `${zip} (${record.city}, ${record.state})`, approximate: true }
    }
    return { ok: false, status: 'not_found', error_message: 'That ZIP code was not found. Try a nearby ZIP or city, state.' }
  }
  if (!value || value.length > 120) {
    return { ok: false, status: 'invalid_request', error_message: 'Enter a US city, state or a 5-digit ZIP code.' }
  }
  let city = normalize(value)
  let state: string | undefined
  // Prefer the longest state name suffix (e.g. New York over York).
  const stateNames = Object.entries(zipcodes.states.full).sort(([a], [b]) => b.length - a.length)
  for (const [name, abbreviation] of stateNames) {
    const suffix = new RegExp(`[,\\s]+${name}$`, 'i')
    if (suffix.test(city)) {
      state = abbreviation
      city = city.replace(suffix, '').trim()
      break
    }
  }
  if (!state) {
    const match = city.match(/^(.*?)[,\s]+([a-z]{2})$/i)
    if (match && zipcodes.states.abbr[match[2].toUpperCase()]) {
      city = match[1].trim()
      state = match[2].toUpperCase()
    }
  }
  const states = cities.get(city)
  if (!states || (state && !states.has(state))) {
    return { ok: false, status: 'not_found', error_message: 'City not found. Enter city, state (for example Memphis, TN), or a ZIP code.' }
  }
  if (!state && states.size > 1) {
    return { ok: false, status: 'ambiguous', error_message: 'That city exists in more than one state. Add the state or use a ZIP code.' }
  }
  const records = states.get(state ?? states.keys().next().value!)!
  // City centers are approximate averages of postal-code centers, not property locations.
  const lat = records.reduce((sum, r) => sum + r.latitude, 0) / records.length
  const lng = records.reduce((sum, r) => sum + r.longitude, 0) / records.length
  return { ok: true, lat, lng, label: `${records[0].city}, ${records[0].state}`, approximate: true }
}
