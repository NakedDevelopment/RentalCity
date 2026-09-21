import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  IncomeVerificationSourceType,
} from 'plaid'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createHash, createPublicKey, verify as verifySignature } from 'node:crypto'

// No silent default: an unset or misspelled PLAID_ENV must fail loudly rather
// than quietly routing every call to sandbox (the same bug class that hit the
// Equifax integration when a stale .replit value silently overrode the
// intended environment — see getEquifaxBase in equifax.ts).
export function getPlaidEnv(): string {
  const env = process.env.PLAID_ENV?.toLowerCase()
  if (env !== 'sandbox' && env !== 'production') {
    throw new Error('PLAID_ENV must be set to sandbox or production')
  }
  return env
}

/**
 * Returns a configured Plaid client, or null if credentials are missing OR
 * PLAID_ENV is unset/invalid. Called unguarded (no try/catch) at the top of
 * most Plaid route handlers, so getPlaidEnv()'s throw is caught here and
 * turned into the same "not configured" null every caller already handles
 * via plaidUnavailable(res) — a config typo should 503 cleanly, not crash
 * the request as an unhandled rejection.
 */
export function getPlaidClient(): PlaidApi | null {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  if (!clientId || !secret) return null

  let env: 'sandbox' | 'production'
  try {
    env = getPlaidEnv() as 'sandbox' | 'production'
  } catch (err) {
    console.error('Plaid client not configured:', (err as Error).message)
    return null
  }
  const basePath = PlaidEnvironments[env]

  const configuration = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })
  return new PlaidApi(configuration)
}

type PlaidWebhookClaims = {
  iat?: number
  request_body_sha256?: string
}

/**
 * Verifies Plaid's ES256 webhook JWT and binds it to the exact raw request body.
 * Plaid rotates keys, so the JWT's kid is resolved through Plaid's authenticated
 * verification-key endpoint rather than from local configuration.
 */
export async function verifyPlaidWebhook(
  client: PlaidApi,
  token: string | undefined,
  rawBody: Buffer | undefined,
): Promise<boolean> {
  if (!token || !rawBody) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false

  let header: { alg?: string; kid?: string }
  let claims: PlaidWebhookClaims
  try {
    header = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'))
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
  } catch {
    return false
  }
  if (header.alg !== 'ES256' || !header.kid) return false

  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.iat !== 'number' || Math.abs(now - claims.iat) > 5 * 60) return false
  const bodyHash = createHash('sha256').update(rawBody).digest('hex')
  if (claims.request_body_sha256 !== bodyHash) return false

  try {
    const { data } = await client.webhookVerificationKeyGet({ key_id: header.kid })
    const jwk = data.key
    if (
      jwk.kid !== header.kid ||
      jwk.alg !== 'ES256' ||
      jwk.kty !== 'EC' ||
      jwk.crv !== 'P-256' ||
      jwk.use !== 'sig' ||
      (jwk.expired_at != null && jwk.expired_at <= now)
    ) {
      return false
    }
    const publicKey = createPublicKey({
      key: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
      format: 'jwk',
    })
    return verifySignature(
      'sha256',
      Buffer.from(`${parts[0]}.${parts[1]}`),
      { key: publicKey, dsaEncoding: 'ieee-p1363' },
      Buffer.from(parts[2], 'base64url'),
    )
  } catch {
    return false
  }
}

/**
 * Returns this app user's Plaid platform-level user id (from `/user/create`),
 * creating and persisting one on first use. Required as the top-level `user_id`
 * field on `/link/token/create` for the Income Verification (Bank Income)
 * product — reused across all of a user's linked accounts rather than
 * recreated per link session.
 */
async function getOrCreatePlaidUserId(
  client: PlaidApi,
  admin: SupabaseClient,
  userId: string,
): Promise<string> {
  const { data } = await admin.from('profiles').select('plaid_user_id').eq('id', userId).maybeSingle()
  const existing = (data as { plaid_user_id?: string | null } | null)?.plaid_user_id
  if (existing) return existing

  const resp = await client.userCreate({ client_user_id: userId })
  const plaidUserId = resp.data.user_id
  const { error } = await admin.from('profiles').update({ plaid_user_id: plaidUserId }).eq('id', userId)
  if (error) throw error
  return plaidUserId
}

// This account is only enabled for Assets, Identity Verification, and Income
// Verification (Bank Income) — confirmed directly via Plaid's dashboard.
// Transactions, Identity, and Liabilities are NOT enabled; requesting them
// makes the whole link-token call fail with INVALID_PRODUCT.
export async function createLinkToken(client: PlaidApi, admin: SupabaseClient, userId: string): Promise<string> {
  const plaidUserId = await getOrCreatePlaidUserId(client, admin, userId)
  const resp = await client.linkTokenCreate({
    user: { client_user_id: userId },
    // Required alongside `user` for the Income Verification (Bank Income)
    // product on accounts using Plaid's post-2025-12-10 User API — must be a
    // TOP-LEVEL field, not nested inside `user`.
    user_id: plaidUserId,
    client_name: 'Rental City',
    products: [Products.Assets, Products.IncomeVerification],
    income_verification: {
      income_source_types: [IncomeVerificationSourceType.Bank],
      bank_income: { days_requested: 90 },
    },
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return resp.data.link_token
}

/**
 * Creates a Plaid Link token scoped to the Identity Verification product so the
 * IDV flow can be rendered as an in-app modal (via react-plaid-link) rather than
 * opening a separate browser window. Plaid picks up any existing pending session
 * for this user+template automatically.
 */
export async function createIdvLinkToken(client: PlaidApi, userId: string): Promise<string> {
  const templateId = process.env.PLAID_IDENTITY_TEMPLATE_ID
  if (!templateId) {
    throw new Error('Identity Verification is not configured. Set PLAID_IDENTITY_TEMPLATE_ID.')
  }
  const resp = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Rental City',
    products: [Products.IdentityVerification],
    identity_verification: {
      template_id: templateId,
      gave_consent: true,
    },
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return resp.data.link_token
}

export type IdentityVerificationResult = {
  sessionId: string
  status: string
  shareableUrl: string | null
}

/**
 * Creates a Plaid Identity Verification session for a user. The returned
 * shareableUrl should be opened in a new window so the user can complete the
 * government-ID check entirely within Plaid's hosted flow — no PII touches
 * our servers.
 *
 * Requires PLAID_IDENTITY_TEMPLATE_ID to be set in the environment. If it is
 * missing the function throws so callers can return a meaningful error.
 */
export async function createIdentityVerificationSession(
  client: PlaidApi,
  userId: string,
): Promise<IdentityVerificationResult> {
  const templateId = process.env.PLAID_IDENTITY_TEMPLATE_ID
  if (!templateId) {
    throw new Error(
      'Identity Verification is not configured. Set PLAID_IDENTITY_TEMPLATE_ID.',
    )
  }
  const resp = await client.identityVerificationCreate({
    template_id: templateId,
    client_user_id: userId,
    // Plaid retains IDV sessions outside our database. If a local profile is
    // deleted/recreated or a create request is retried, recover the existing
    // user+template session instead of failing with IDENTITY_VERIFICATION_ALREADY_EXISTS.
    is_idempotent: true,
    is_shareable: true,
    // gave_consent must be true — the tenant has accepted our T&C which include
    // the Plaid IDV consent language before reaching this step.
    gave_consent: true,
  })
  return {
    sessionId: resp.data.id,
    status: resp.data.status,
    shareableUrl: resp.data.shareable_url ?? null,
  }
}

/**
 * Fetches the current status of an existing Identity Verification session.
 */
export async function getIdentityVerificationSession(
  client: PlaidApi,
  sessionId: string,
): Promise<IdentityVerificationResult> {
  const resp = await client.identityVerificationGet({
    identity_verification_id: sessionId,
  })
  return {
    sessionId: resp.data.id,
    status: resp.data.status,
    shareableUrl: resp.data.shareable_url ?? null,
  }
}

export async function exchangePublicToken(
  client: PlaidApi,
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const resp = await client.itemPublicTokenExchange({ public_token: publicToken })
  return { accessToken: resp.data.access_token, itemId: resp.data.item_id }
}

export type IncomeStream = {
  name: string
  monthlyAmountCents: number
  frequency: string
  monthsSeen: number | null
}

export type AccountInfo = {
  name: string
  mask: string | null
  subtype: string | null
  availableCents: number | null
  currentCents: number | null
}

export type AssetTier = 'low' | 'moderate' | 'high' | 'very_high'

/**
 * Converts total depository assets to a reserve tier relative to monthly income.
 *  very_high : ≥ 6 months of income in assets
 *  high      : 3–6 months
 *  moderate  : 1–3 months
 *  low       : < 1 month
 * Falls back to raw asset buckets when income is unknown (0).
 */
export function computeAssetTier(totalAssetsCents: number, monthlyIncomeCents: number): AssetTier {
  if (monthlyIncomeCents > 0) {
    const months = totalAssetsCents / monthlyIncomeCents
    if (months >= 6) return 'very_high'
    if (months >= 3) return 'high'
    if (months >= 1) return 'moderate'
    return 'low'
  }
  // Fallback when income is unknown: bucket by absolute asset value
  if (totalAssetsCents >= 1_500_000) return 'very_high' // $15k+
  if (totalAssetsCents >= 600_000) return 'high'        // $6k–$15k
  if (totalAssetsCents >= 200_000) return 'moderate'    // $2k–$6k
  return 'low'
}

export type PlaidFinancialSummary = {
  institutionName: string | null
  accountsCount: number

  // Income — raw detected value plus a ±15 % range for display
  incomeVerified: boolean
  monthlyIncomeCents: number
  monthlyIncomeRangeLowCents: number | null
  monthlyIncomeRangeHighCents: number | null
  incomeStreams: IncomeStream[]

  // Balances / proof of funds
  balancesVerified: boolean
  availableBalanceCents: number
  currentBalanceCents: number
  totalAssetsCents: number
  assetTier: AssetTier | null
  accounts: AccountInfo[]

  // Debts / DTI — an aggregate loan-payment-outflow signal from Asset Report
  // Insights, not a per-loan breakdown (no balances/APRs — that needs
  // Liabilities, which this account doesn't have).
  debtsVerified: boolean
  totalMonthlyDebtCents: number
  dtiRatio: number | null

  // Identity (bank account owner name match, from the Asset Report's own
  // owner data — separate from Plaid's government-ID Identity Verification).
  identityVerified: boolean
}

const toCents = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) : 0
const toCentsOrNull = (n: number | null | undefined) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 100) : null

function monthsBetween(start?: string | null, end?: string | null): number | null {
  if (!start || !end) return null
  const s = new Date(start)
  const e = new Date(end)
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null
  const months = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth())
  return months < 0 ? 0 : months + 1
}

// Assets and Bank Income are report-based products: create, then wait for a
// webhook (PRODUCT_READY / BANK_INCOME_COMPLETE) before the data is fetchable.
const REPORT_DAYS_REQUESTED = 90

/** Starts Asset Report generation; the report is fetchable once the ASSETS/PRODUCT_READY webhook fires. */
export async function createAssetReport(
  client: PlaidApi,
  accessToken: string,
  webhookUrl: string,
): Promise<{ assetReportId: string; assetReportToken: string }> {
  const resp = await client.assetReportCreate({
    access_tokens: [accessToken],
    days_requested: REPORT_DAYS_REQUESTED,
    options: { webhook: webhookUrl },
  })
  return { assetReportId: resp.data.asset_report_id, assetReportToken: resp.data.asset_report_token }
}

/** Fetches a completed Asset Report with Insights (categorized transactions + risk/affordability data). */
export async function getAssetReport(client: PlaidApi, assetReportToken: string) {
  const resp = await client.assetReportGet({ asset_report_token: assetReportToken, include_insights: true })
  return resp.data.report
}

/** Fetches the Bank Income report for this Plaid platform user, or null if none exists yet. */
export async function getBankIncome(client: PlaidApi, plaidUserId: string) {
  const resp = await client.creditBankIncomeGet({ user_id: plaidUserId })
  return resp.data.bank_income?.[0] ?? null
}

/** Requests a new Asset Report for an existing item (Asset Reports are immutable). Fires its own PRODUCT_READY webhook. */
export async function refreshAssetReport(
  client: PlaidApi,
  assetReportToken: string,
  webhookUrl: string,
): Promise<{ assetReportId: string; assetReportToken: string }> {
  const resp = await client.assetReportRefresh({
    asset_report_token: assetReportToken,
    options: { webhook: webhookUrl },
  })
  return { assetReportId: resp.data.asset_report_id, assetReportToken: resp.data.asset_report_token }
}

/** Basic Item metadata lookup — not gated by any specific product entitlement. */
export async function getInstitutionName(client: PlaidApi, accessToken: string): Promise<string | null> {
  try {
    const itemResp = await client.itemGet({ access_token: accessToken })
    const institutionId = itemResp.data.item?.institution_id
    if (!institutionId) return null
    const instResp = await client.institutionsGetById({
      institution_id: institutionId,
      country_codes: [CountryCode.Us],
    })
    return instResp.data.institution?.name ?? null
  } catch {
    return null
  }
}

type AssetReportData = Awaited<ReturnType<typeof getAssetReport>>
type BankIncomeData = Awaited<ReturnType<typeof getBankIncome>>

/**
 * Combines whichever of the two async reports have arrived so far into one
 * summary. Assets (balances, owner-name identity, aggregate debt) and Bank
 * Income (income) land independently via separate webhooks — either may be
 * null if its report hasn't completed yet, in which case that section of the
 * summary stays unverified rather than failing the whole computation.
 */
export function computeFinancialSummary(
  assetReport: AssetReportData | null,
  bankIncome: BankIncomeData | null,
): PlaidFinancialSummary {
  let institutionName: string | null = null
  let accountsCount = 0
  let available = 0
  let current = 0
  let totalAssets = 0
  let balancesVerified = false
  let identityVerified = false
  let debtsVerified = false
  let totalMonthlyDebtCents = 0
  const accounts: AccountInfo[] = []

  if (assetReport) {
    institutionName = assetReport.items[0]?.institution_name ?? null
    for (const item of assetReport.items) {
      for (const a of item.accounts) {
        accountsCount += 1
        accounts.push({
          name: a.official_name || a.name || a.subtype || 'Account',
          mask: a.mask,
          subtype: a.subtype ?? null,
          availableCents: toCentsOrNull(a.balances.available),
          currentCents: toCentsOrNull(a.balances.current),
        })
        if (a.type === 'depository') {
          const avail = typeof a.balances.available === 'number' ? a.balances.available : null
          const curr = typeof a.balances.current === 'number' ? a.balances.current : null
          if (avail !== null) available += avail
          if (curr !== null) current += curr
          totalAssets += avail ?? curr ?? 0
        }
        if (a.owners.some((o) => (o.names ?? []).some((n) => !!n))) identityVerified = true
      }
    }
    balancesVerified = accountsCount > 0

    const loanPayments = assetReport.insights?.risk?.loan_payments
    if (loanPayments) {
      debtsVerified = true
      totalMonthlyDebtCents = toCents(loanPayments.monthly_average?.amount ?? 0)
    }
  }

  let monthlyIncomeCents = 0
  const incomeStreams: IncomeStream[] = []
  if (bankIncome) {
    const monthsInWindow = (bankIncome.days_requested || REPORT_DAYS_REQUESTED) / 30
    for (const item of bankIncome.items ?? []) {
      for (const source of item.bank_income_sources ?? []) {
        const totalAmount = Math.abs(source.total_amount ?? 0)
        if (totalAmount <= 0) continue
        const monthlyAmountCents = Math.round((totalAmount / monthsInWindow) * 100)
        monthlyIncomeCents += monthlyAmountCents
        incomeStreams.push({
          name: source.income_description || 'Income source',
          monthlyAmountCents,
          frequency: source.pay_frequency ?? 'UNKNOWN',
          monthsSeen: monthsBetween(source.start_date, source.end_date),
        })
      }
    }
    incomeStreams.sort((a, b) => b.monthlyAmountCents - a.monthlyAmountCents)
  }

  // Build a ±15 % income range for display purposes. Only set when income was
  // actually detected; null when we have nothing to show.
  const monthlyIncomeRangeLowCents = monthlyIncomeCents > 0 ? Math.round(monthlyIncomeCents * 0.85) : null
  const monthlyIncomeRangeHighCents = monthlyIncomeCents > 0 ? Math.round(monthlyIncomeCents * 1.15) : null

  // DTI needs both halves to have landed. A ratio above ~500% means income
  // wasn't detected reliably, so it's nulled rather than shown as an absurd
  // percentage (same guard as the previous implementation).
  const rawDti =
    monthlyIncomeCents > 0 && debtsVerified
      ? Math.round((totalMonthlyDebtCents / monthlyIncomeCents) * 10000) / 10000
      : null
  const dtiRatio = rawDti !== null && rawDti <= 5 ? rawDti : null

  const totalAssetsCentsVal = toCents(totalAssets)
  const assetTier = balancesVerified ? computeAssetTier(totalAssetsCentsVal, monthlyIncomeCents) : null

  return {
    institutionName,
    accountsCount,

    incomeVerified: monthlyIncomeCents > 0,
    monthlyIncomeCents,
    monthlyIncomeRangeLowCents,
    monthlyIncomeRangeHighCents,
    incomeStreams,

    balancesVerified,
    availableBalanceCents: toCents(available),
    currentBalanceCents: toCents(current),
    totalAssetsCents: totalAssetsCentsVal,
    assetTier,
    accounts,

    debtsVerified,
    totalMonthlyDebtCents,
    dtiRatio,

    identityVerified,
  }
}
