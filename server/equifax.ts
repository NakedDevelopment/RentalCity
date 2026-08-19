/**
 * Equifax OneView Consumer Credit API client.
 *
 * Auth:   OAuth2 client_credentials → bearer token (cached).
 * Credit: POST /business/oneview/consumer-credit/v1/reports/credit-report
 * PDF:    GET  /business/oneview/consumer-credit/v1/reports/credit-report/{id}
 *
 * SSN handling: encrypt on the way into the DB, decrypt only in memory during
 * the credit-report call, never logged or returned to clients.
 */

import crypto from 'crypto'

const SANDBOX_BASE = 'https://api.sandbox.equifax.com'
const PROD_BASE = 'https://api.equifax.com'

export function getEquifaxBase(): string {
  return process.env.EQUIFAX_ENV === 'production' ? PROD_BASE : SANDBOX_BASE
}

// ─── OAuth token (in-process cache) ──────────────────────────────────────────

type TokenCache = { token: string; expiresAt: number }
let tokenCache: TokenCache | null = null

export async function getEquifaxToken(): Promise<string> {
  const now = Date.now()
  if (tokenCache && tokenCache.expiresAt > now + 30_000) return tokenCache.token

  const clientId = process.env.EQUIFAX_CLIENT_ID
  const clientSecret = process.env.EQUIFAX_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Equifax credentials not configured')

  const base = getEquifaxBase()
  const res = await fetch(`${base}/v2/oauth/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      // Scope always references the production hostname even in sandbox
      scope: 'https://api.equifax.com/business/oneview/consumer-credit/v1',
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Equifax auth failed (${res.status}): ${text}`)
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number }
  const ttlMs = (json.expires_in ?? 3600) * 1000
  tokenCache = { token: json.access_token, expiresAt: now + ttlMs }
  return tokenCache.token
}

// ─── Credit report ────────────────────────────────────────────────────────────

export type EquifaxConsumer = {
  firstName: string
  lastName: string
  ssn: string       // plain text — used only in this call, never persisted
  houseNumber: string
  streetName: string
  streetType: string
  city: string
  state: string
  zip: string
}

export type EquifaxReportResult = {
  reportId: string
}

export async function requestCreditReport(
  consumer: EquifaxConsumer,
): Promise<EquifaxReportResult> {
  const base = getEquifaxBase()
  const token = await getEquifaxToken()

  const memberNumber = process.env.EQUIFAX_MEMBER_NUMBER
  const securityCode = process.env.EQUIFAX_SECURITY_CODE
  const customerCode = process.env.EQUIFAX_CUSTOMER_CODE
  if (!memberNumber || !securityCode || !customerCode) {
    throw new Error('Equifax account credentials (memberNumber / securityCode / customerCode) not configured')
  }

  const payload = {
    consumers: {
      name: [{ identifier: 'current', firstName: consumer.firstName, lastName: consumer.lastName }],
      socialNum: [{ identifier: 'current', number: consumer.ssn.replace(/\D/g, '') }],
      // Equifax caps streetType at 2 chars (only fits abbreviations like "ST"/"DR"/"LN" —
      // not "BLVD"/"AVE"/"WAY"/"CIR", all of which this app's own street-type options
      // include). The spec's own documented alternative is to fold houseNumber +
      // streetName + streetType into the single streetName field (max 26 chars)
      // instead of submitting streetType separately — avoids truncating/mangling it.
      addresses: [{
        identifier: 'current',
        streetName: `${consumer.houseNumber} ${consumer.streetName} ${consumer.streetType}`.trim().slice(0, 26),
        city: consumer.city,
        state: consumer.state.toUpperCase().slice(0, 2),
        zip: consumer.zip,
      }],
    },
    customerReferenceIdentifier: `RC-${Date.now()}`,
    customerConfiguration: {
      equifaxUSConsumerCreditReport: {
        pdfComboIndicator: 'Y',
        // Required for PDFs to render with code/description pairs instead of bare codes.
        codeDescriptionRequired: true,
        memberNumber,
        securityCode,
        customerCode,
        multipleReportIndicator: '1',
        ECOAInquiryType: 'Individual',
        // FCRA permissible-purpose declaration for this tenant-screening use case.
        endUserInformation: {
          endUsersName: 'Rental City',
          permissiblePurposeCode: '15',
        },
      },
    },
  }

  const res = await fetch(
    `${base}/business/oneview/consumer-credit/v1/reports/credit-report`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    },
  )

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Equifax credit report failed (${res.status}): ${text}`)
  }

  // Equifax's response has no top-level reportId field — the PDF reference is
  // the trailing UUID of the first `links[].href`, e.g.:
  //   /business/oneview/consumer-credit/v1/reports/credit-report/0a341dc4-...
  const json = (await res.json()) as { links?: Array<{ href?: string }> }
  const href = json.links?.[0]?.href ?? ''
  const reportId = href.split('/').filter(Boolean).pop() ?? ''
  if (!reportId) throw new Error('Equifax returned no report link')
  return { reportId }
}

/** Returns the authenticated URL to fetch a credit-report PDF from Equifax. */
export function equifaxPdfEndpoint(reportId: string): string {
  return `${getEquifaxBase()}/business/oneview/consumer-credit/v1/reports/credit-report/${reportId}`
}

// ─── SSN encryption (AES-256-GCM) ────────────────────────────────────────────

function getSsnKey(): Buffer {
  const hex = process.env.SSN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('SSN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)')
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts an SSN for storage. Format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 * Never log or return the raw output — treat it as opaque ciphertext.
 */
export function encryptSSN(ssn: string): string {
  const key = getSsnKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(ssn, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts an SSN for use in a single Equifax API call.
 * The returned string should be used immediately and never stored.
 */
export function decryptSSN(stored: string): string {
  const key = getSsnKey()
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid SSN ciphertext format')
  const [ivHex, authTagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}
