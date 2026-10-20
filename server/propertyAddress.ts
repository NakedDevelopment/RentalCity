export type PropertyAddress = {
  addressLine1?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  postalCode?: string | null
}

const abbreviations: Record<string, string> = {
  street: 'st', avenue: 'ave', road: 'rd', boulevard: 'blvd', drive: 'dr',
  lane: 'ln', court: 'ct', circle: 'cir', place: 'pl', terrace: 'ter',
  parkway: 'pkwy', highway: 'hwy', trail: 'trl', north: 'n', south: 's',
  east: 'e', west: 'w', northeast: 'ne', northwest: 'nw', southeast: 'se', southwest: 'sw',
}
const suffixes = new Set(['st', 'ave', 'rd', 'blvd', 'dr', 'ln', 'ct', 'cir', 'pl', 'ter', 'pkwy', 'hwy', 'trl', 'way', 'mall'])
const directions = new Set(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])
const text = (value: unknown) => typeof value === 'string' ? value : ''
const normalize = (value: unknown) => text(value).toLowerCase().replace(/[.,]/g, '').trim().split(/\s+/)
  .map((word) => abbreviations[word] ?? word).join(' ')
const unitPattern = /(?:\b(?:apt|apartment|unit|suite|ste)\b\.?\s*#?\s*|#\s*)([a-z0-9]+(?:[-/][a-z0-9]+)*)\b/gi

/** Extract an inline unit without losing a street's trailing direction (e.g. #1 SW). */
export function parseStreet(line1: unknown, line2?: unknown) {
  const units: string[] = []
  const street = text(line1).replace(unitPattern, (_match, unit: string) => {
    units.push(unit.toLowerCase())
    return ' '
  }).replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim()
  const secondLine = text(line2).trim()
  if (secondLine) {
    const extracted = [...secondLine.matchAll(new RegExp(unitPattern.source, 'gi'))]
    units.push(...(extracted.length ? extracted.map((match) => match[1].toLowerCase()) : [normalize(secondLine)]))
  }
  const tokens = normalize(street).split(' ').filter(Boolean)
  const house = tokens.shift() ?? ''
  const fractional = tokens[0]?.match(/^\d+\/\d+$/) ? tokens.shift() : undefined
  const pre = tokens.length > 1 && directions.has(tokens[0]) ? tokens.shift() : undefined
  const post = tokens.length > 1 && directions.has(tokens[tokens.length - 1]) ? tokens.pop() : undefined
  const suffix = tokens.length > 1 && suffixes.has(tokens[tokens.length - 1]) ? tokens.pop() : undefined
  return {
    street, house: fractional ? `${house} ${fractional}` : house,
    name: tokens.join(' '), pre, post, suffix,
    unit: units[0], unitConflict: new Set(units).size > 1,
  }
}

export type PropertyConflict = 'invalid_address' | 'street_number_conflict' | 'street_name_conflict' |
  'street_type_conflict' | 'direction_conflict' | 'unit_conflict' | 'state_conflict' | 'zip_conflict' | 'city_conflict'

/** A missing street type may be completed, but explicit conflicting components never are. */
export function propertyConflict(address: PropertyAddress, record: Record<string, unknown>): PropertyConflict | null {
  const requested = parseStreet(address.addressLine1, address.addressLine2)
  const returned = parseStreet(record.addressLine1, record.addressLine2)
  if (!requested.name || !returned.name || !/^\d/.test(requested.house) || !/^\d/.test(returned.house)) return 'invalid_address'
  if (requested.house !== returned.house) return 'street_number_conflict'
  if (requested.name !== returned.name) return 'street_name_conflict'
  if (requested.pre !== returned.pre || requested.post !== returned.post) return 'direction_conflict'
  if (requested.suffix && returned.suffix && requested.suffix !== returned.suffix) return 'street_type_conflict'
  if (requested.unitConflict || returned.unitConflict ||
    (requested.unit && returned.unit && requested.unit !== returned.unit)) return 'unit_conflict'
  if (address.state?.trim() && normalize(address.state) !== normalize(record.state)) return 'state_conflict'
  const zip = address.postalCode?.trim().slice(0, 5)
  if (zip && zip !== text(record.zipCode).slice(0, 5)) return 'zip_conflict'
  if (!zip && address.city?.trim() && normalize(address.city) !== normalize(record.city)) return 'city_conflict'
  return null
}

export function isSameProperty(address: PropertyAddress, record: Record<string, unknown>): boolean {
  return propertyConflict(address, record) === null
}
