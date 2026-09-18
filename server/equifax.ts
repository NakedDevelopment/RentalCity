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
const UAT_BASE = 'https://api.uat.equifax.com'
const PROD_BASE = 'https://api.equifax.com'

export type EquifaxEnv = 'sandbox' | 'uat' | 'production'

export function isEquifaxEnv(value: string | undefined): value is EquifaxEnv {
  return value === 'sandbox' || value === 'uat' || value === 'production'
}

// Sandbox and UAT are separate Equifax environments with separate product
// entitlements, not just separate data sets — an application "promoted to
// Test" (Equifax's dashboard label for UAT) is no longer recognized by the
// plain Sandbox host, and vice versa. Calling the wrong host for your
// application's actual promotion state fails OAuth with a generic
// "No product match found", not an environment-specific error.
//
// Each landlord's Equifax-issued member number is itself environment-locked
// (reseller subscribers only receive production numbers), so the caller must
// state which environment a given credential set belongs to rather than this
// reading one process-wide default.
export function getEquifaxBase(env: EquifaxEnv): string {
  if (env === 'production') return PROD_BASE
  if (env === 'uat') return UAT_BASE
  return SANDBOX_BASE
}

/** Resolves Rental City's own internal test environment from EQUIFAX_ENV (sandbox/uat only — never production). */
export function getInternalTestEnv(): EquifaxEnv {
  const env = process.env.EQUIFAX_ENV?.toLowerCase()
  if (env === 'uat') return 'uat'
  if (env === 'sandbox') return 'sandbox'
  throw new Error('EQUIFAX_ENV must be set to sandbox or uat')
}

// ─── OAuth token (in-process cache, one per environment host) ───────────────

type TokenCache = { token: string; expiresAt: number }
const tokenCacheByBase = new Map<string, TokenCache>()

export async function getEquifaxToken(env: EquifaxEnv): Promise<string> {
  const base = getEquifaxBase(env)
  const now = Date.now()
  const cached = tokenCacheByBase.get(base)
  if (cached && cached.expiresAt > now + 30_000) return cached.token

  const clientId = process.env.EQUIFAX_CLIENT_ID
  const clientSecret = process.env.EQUIFAX_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error('Equifax credentials not configured')

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
    throw new Error(`Equifax auth failed (${res.status})`)
  }

  const json = (await res.json()) as { access_token: string; expires_in?: number }
  const ttlMs = (json.expires_in ?? 3600) * 1000
  const entry = { token: json.access_token, expiresAt: now + ttlMs }
  tokenCacheByBase.set(base, entry)
  return entry.token
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

export type EquifaxSubscriberCredentials = {
  memberNumber: string
  securityCode: string
  customerCode: string
}

export async function requestCreditReport(
  consumer: EquifaxConsumer,
  credentials: EquifaxSubscriberCredentials,
  env: EquifaxEnv,
): Promise<EquifaxReportResult> {
  const base = getEquifaxBase(env)
  if (env !== 'production' && consumer.ssn.replace(/\D/g, '') !== '666000001') {
    throw new Error('Non-production Equifax environments accept only the approved CTEST consumer')
  }
  const token = await getEquifaxToken(env)

  const { memberNumber, securityCode, customerCode } = credentials
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
    throw new Error(`Equifax credit report failed (${res.status})`)
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
export function equifaxPdfEndpoint(reportId: string, env: EquifaxEnv): string {
  return `${getEquifaxBase(env)}/business/oneview/consumer-credit/v1/reports/credit-report/${reportId}`
}

// ─── Sensitive-field encryption (AES-256-GCM) ────────────────────────────────
// Used for both SSN (credit + background checks) and date of birth
// (background checks only) — same key, same generic string encryption.

function getFieldEncryptionKey(): Buffer {
  const hex = process.env.SSN_ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('SSN_ENCRYPTION_KEY must be a 32-byte hex string (64 chars)')
  return Buffer.from(hex, 'hex')
}

/**
 * Encrypts a sensitive field for storage. Format: `<iv_hex>:<authTag_hex>:<ciphertext_hex>`
 * Never log or return the raw output — treat it as opaque ciphertext.
 */
export function encryptField(value: string): string {
  const key = getFieldEncryptionKey()
  const iv = crypto.randomBytes(16)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`
}

/**
 * Decrypts a sensitive field for use in a single Equifax API call.
 * The returned string should be used immediately and never stored.
 */
export function decryptField(stored: string): string {
  const key = getFieldEncryptionKey()
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivHex, authTagHex, dataHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const authTag = Buffer.from(authTagHex, 'hex')
  const data = Buffer.from(dataHex, 'hex')
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString('utf8')
}

export const encryptSSN = encryptField
export const decryptSSN = decryptField
