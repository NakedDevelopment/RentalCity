/**
 * Equifax background-check products via Innovative Data Solutions' legacy
 * "IDS WS 2.0" XML web service — NCIS-Alias (criminal) and AssuredTenant
 * Alias (eviction). Both products share one endpoint/login; only the
 * <product> element and required subject fields differ.
 *
 * Unlike OneView, this service returns the full sensitive record set (case
 * numbers, offense descriptions, eviction judgments, addresses, aliases)
 * directly in the response, with no re-fetchable artifact. We compute a
 * pass/fail verdict from the response and discard everything else — the raw
 * response is never persisted or logged.
 *
 * NOTE: not yet verified against a live sandbox response (no IDS credentials
 * configured in this environment yet). The response-envelope handling below
 * is defensive because the spec notes "<" is returned as "&lt;" in some
 * contexts, which is the classic sign of an ASMX POST binding wrapping a
 * string-typed return value in an outer XML element — this code tries a
 * direct parse first and falls back to unwrapping such an envelope. Re-verify
 * once real credentials are available.
 */

import { XMLParser } from 'fast-xml-parser'

const IDS_BASE = 'https://xml.innovativedatasolutions.com/NatCrimWs/Search.asmx'

function getIdsCredentials(): { login: string; password: string } {
  const login = process.env.INNOVATIVE_ENTERPRISES_LOGIN
  const password = process.env.INNOVATIVE_ENTERPRISES_PASSWORD
  if (!login || !password) {
    throw new Error('Equifax IDS credentials not configured (INNOVATIVE_ENTERPRISES_LOGIN / INNOVATIVE_ENTERPRISES_PASSWORD)')
  }
  return { login, password }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type BackgroundCheckSubject = {
  firstName: string
  lastName: string
  ssn: string // digits only, used once and never logged
  dob: string // MM/DD/YYYY, required by NCIS-Alias only
  houseNumber: string
  streetName: string
  city: string
  state: string
  zip: string
}

export type IeiResponseCode = {
  code: string
  message: string
}

// ─── Request builders ────────────────────────────────────────────────────────

export function buildNcisAliasRequest(subject: BackgroundCheckSubject, quoteback: string): string {
  return (
    '<ieirequest><order>' +
    `<quoteback>${escapeXml(quoteback)}</quoteback>` +
    '<subject>' +
    `<firstname>${escapeXml(subject.firstName)}</firstname>` +
    `<lastname>${escapeXml(subject.lastName)}</lastname>` +
    `<ssn>${escapeXml(subject.ssn)}</ssn>` +
    `<dob>${escapeXml(subject.dob)}</dob>` +
    '</subject>' +
    '<product><ncis-alias><settings>' +
    // Fail-rule design (see deriveCriminalPass): felony + sex-offender records
    // are the disqualifying signal, so we request all case types and let the
    // pass/fail logic decide, rather than filtering at request time.
    '<includecasetypefelony>1</includecasetypefelony>' +
    '<includecasetypemisdemeanor>1</includecasetypemisdemeanor>' +
    '<includecasetypetraffic>1</includecasetypetraffic>' +
    '<includecasetypeunknown>1</includecasetypeunknown>' +
    '</settings></ncis-alias></product>' +
    '</order></ieirequest>'
  )
}

export function buildAssuredTenantRequest(subject: BackgroundCheckSubject, quoteback: string): string {
  return (
    '<ieirequest><order>' +
    `<quoteback>${escapeXml(quoteback)}</quoteback>` +
    '<product><assuredtenant><settings></settings></assuredtenant></product>' +
    '<subject>' +
    `<firstname>${escapeXml(subject.firstName)}</firstname>` +
    `<lastname>${escapeXml(subject.lastName)}</lastname>` +
    `<ssn>${escapeXml(subject.ssn)}</ssn>` +
    '<address1>' +
    `<buildingnum>${escapeXml(subject.houseNumber)}</buildingnum>` +
    `<streetname>${escapeXml(subject.streetName)}</streetname>` +
    `<city>${escapeXml(subject.city)}</city>` +
    `<state>${escapeXml(subject.state)}</state>` +
    `<zip>${escapeXml(subject.zip)}</zip>` +
    '</address1>' +
    '</subject>' +
    '</order></ieirequest>'
  )
}

// ─── Transport + response envelope handling ──────────────────────────────────

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

/** Posts an inputXML document to PlaceOrder and returns the parsed <ieiresponse> tree. */
async function placeOrder(inputXml: string): Promise<any> {
  const { login, password } = getIdsCredentials()
  const res = await fetch(`${IDS_BASE}/PlaceOrder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ Login: login, Password: password, inputXML: inputXml }),
  })
  const text = await res.text()
  if (!res.ok) throw new Error(`Equifax IDS request failed (${res.status})`)
  return parseIeiResponse(text)
}

/**
 * ASMX's plain-POST binding wraps a string-typed return value in an outer
 * element with the actual XML content HTML-entity-encoded inside it. Try a
 * direct parse first (in case the response is already unwrapped); if there's
 * no ieiresponse at the root, look for a single string-valued child and parse
 * that as the real response.
 */
function parseIeiResponse(rawText: string): any {
  const direct = parser.parse(rawText)
  if (direct?.ieiresponse) return direct.ieiresponse

  const rootKey = Object.keys(direct ?? {})[0]
  const inner = rootKey ? direct[rootKey] : null
  const innerText = typeof inner === 'string' ? inner : typeof inner === 'object' ? inner?.['#text'] : null
  if (typeof innerText === 'string') {
    const reparsed = parser.parse(innerText)
    if (reparsed?.ieiresponse) return reparsed.ieiresponse
  }
  throw new Error('Could not parse Equifax IDS response — unrecognized envelope shape')
}

function getRequestCode(response: any): IeiResponseCode {
  const info = response?.requestinformation
  return {
    code: String(info?.['@_code'] ?? ''),
    message: String(info?.codemessage ?? ''),
  }
}

// ─── NCIS-Alias (criminal) ────────────────────────────────────────────────────

export type CriminalCheckResult = { status: 'complete' | 'pending' | 'failed'; pass: boolean | null; message: string }

export async function runNcisAliasCheck(subject: BackgroundCheckSubject, quoteback: string): Promise<CriminalCheckResult> {
  const response = await placeOrder(buildNcisAliasRequest(subject, quoteback))
  const { code, message } = getRequestCode(response)

  if (code === '101') return { status: 'complete', pass: true, message } // No Records Found
  if (code === '102') return { status: 'pending', pass: null, message } // offline/async jurisdiction
  if (code !== '100') return { status: 'failed', pass: null, message: message || `Equifax error ${code}` }

  return { status: 'complete', pass: deriveCriminalPass(response), message }
}

/**
 * FAIL if any felony-category offense or sex-offender-registry hit is found.
 * Misdemeanor/traffic-only records don't fail it (Rental City policy, per
 * the task's explicit sign-off — see the Gate 1 plan this was proposed in).
 */
function deriveCriminalPass(response: any): boolean {
  const records = asArray(response?.criminalinformation?.records?.record)
  for (const record of records) {
    const category = String(record?.category ?? '').toUpperCase()
    if (category.includes('SEX')) return false
    const offenses = asArray(record?.offenses?.offense)
    for (const offense of offenses) {
      if (String(offense?.casetype ?? '').toUpperCase() === 'FELONY') return false
    }
  }
  return true
}

// ─── AssuredTenant Alias (eviction) ──────────────────────────────────────────

export type EvictionCheckResult = { status: 'complete' | 'pending' | 'failed'; pass: boolean | null; message: string }

export async function runAssuredTenantCheck(subject: BackgroundCheckSubject, quoteback: string): Promise<EvictionCheckResult> {
  const response = await placeOrder(buildAssuredTenantRequest(subject, quoteback))
  const { code, message } = getRequestCode(response)

  if (code === '101') return { status: 'complete', pass: true, message }
  if (code === '102') return { status: 'pending', pass: null, message }
  if (code !== '100') return { status: 'failed', pass: null, message: message || `Equifax error ${code}` }

  return { status: 'complete', pass: deriveEvictionPass(response), message }
}

/**
 * FAIL if any record shows a judgment for the plaintiff (landlord) — an
 * actual completed eviction, not a dismissed or tenant-won case.
 */
function deriveEvictionPass(response: any): boolean {
  const records = asArray(response?.evictioninformation?.records?.record)
  return !records.some((r: any) => String(r?.judgement ?? '').toUpperCase() === 'PLAINTIFF')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** fast-xml-parser returns a single object (not an array) when there's exactly one match. */
function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value == null) return []
  return Array.isArray(value) ? value : [value]
}
