import { config } from 'dotenv'
config({ path: '.env.development.local' })
config({ path: '.env.local' })
config()
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import {
  landlordAnswersToPrefs,
  tenantAnswersToHistory,
  scoreRentToIncome,
  computeMatch,
  type MatchResult,
} from './match'
import {
  getPlaidClient,
  getPlaidEnv,
  createLinkToken,
  exchangePublicToken,
  fetchFinancialSummary,
} from './plaid'
import { randomUUID } from 'node:crypto'
import { buildReport, type ReportData, type ReportComparable } from './report-template'
import { sendReportEmail } from './email'
import Stripe from 'stripe'
import type { Request, Response } from 'express'

const app = express()
const PORT = process.env.PORT || 3001

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const backgroundChecksEnv = process.env.BACKGROUNDCHECKS_ENV || 'sandbox'
const backgroundChecksApiToken =
  backgroundChecksEnv === 'production'
    ? process.env.BACKGROUNDCHECKS_API_TOKEN_PROD
    : process.env.BACKGROUNDCHECKS_API_TOKEN_SANDBOX

// Stripe client. Prefer the test key in development, the live key in production,
// each falling back to the other if only one is configured.
let stripeSingleton: Stripe | null = null
function getStripe(): Stripe | null {
  if (stripeSingleton) return stripeSingleton
  const key =
    process.env.NODE_ENV === 'production'
      ? process.env.STRIPE_API_KEY || process.env.STRIPE_API_KEY_TEST
      : process.env.STRIPE_API_KEY_TEST || process.env.STRIPE_API_KEY
  if (!key) return null
  stripeSingleton = new Stripe(key)
  return stripeSingleton
}

app.use(cors({ origin: true }))

// Stripe webhook needs the raw request body for signature verification, so it
// must be registered before express.json() parses the body.
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), handleStripeWebhook)

app.use(express.json())

function backgroundChecksBaseUrl() {
  return backgroundChecksEnv === 'production' ? 'https://app.backgroundchecks.com/api' : 'https://sandbox.backgroundchecks.com/api'
}

async function backgroundChecksFetch(path: string, init?: RequestInit) {
  if (!backgroundChecksApiToken) {
    throw new Error('Missing BackgroundChecks.com api token')
  }
  const url = new URL(backgroundChecksBaseUrl() + path)
  url.searchParams.set('api_token', backgroundChecksApiToken)
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`BackgroundChecks.com error (${res.status}): ${text || res.statusText}`)
  }
  return res
}

function getSupabaseAdmin() {
  if (!supabaseUrl || !supabaseServiceKey) return null
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function authUser(token: string | null) {
  if (!token) return null
  const admin = getSupabaseAdmin()
  if (!admin) return null
  const { data: { user }, error } = await admin.auth.getUser(token)
  return error || !user ? null : user
}

/** Resolves authenticated user id if they are an admin (profiles.role = admin); otherwise sends 401/403 and returns null. */
async function requireAdmin(req: express.Request, res: express.Response): Promise<string | null> {
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) {
    res.status(401).json({ error: 'Unauthorized' })
    return null
  }
  const admin = getSupabaseAdmin()
  if (!admin) {
    res.status(500).json({ error: 'Server configuration error' })
    return null
  }
  const { data: prof, error } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (error || prof?.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' })
    return null
  }
  return user.id
}

/** 0–100 for UI when overall_score is unset but dimension scores exist */
function tenantDisplayScoreFromQuestionnaire(t: {
  overall_score?: number | null
  affordability_score?: number | null
  stability_score?: number | null
  payment_risk_score?: number | null
  lifestyle_score?: number | null
}): number | null {
  if (t.overall_score != null && Number.isFinite(Number(t.overall_score))) {
    return Math.round(Number(t.overall_score))
  }
  const a = Number(t.affordability_score)
  const s = Number(t.stability_score)
  const p = Number(t.payment_risk_score)
  const l = Number(t.lifestyle_score)
  const vals = [a, s, p, l].map((v) => (Number.isFinite(v) ? v : null))
  if (vals.some((v) => v != null)) {
    const nums = vals.map((v) => (v != null ? v : 5))
    return Math.round(((nums[0] + nums[1] + nums[2] + nums[3]) / 4) * 10)
  }
  return null
}

const UUID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type LandlordCatalogRowOut = {
  propertyId: string
  tenantId: string
  match: MatchResult & { tenantScore?: number | null }
  name: string
  avatarUrl: string | null
}

/** Same candidate set as POST /api/matches/landlord-catalog (used for auth + listing). */
async function buildLandlordCatalogRows(
  admin: SupabaseClient,
  landlordId: string,
  uniquePids: string[],
  limitPerProperty: number,
): Promise<LandlordCatalogRowOut[]> {
  const { data: properties } = await admin
    .from('properties')
    .select('id, landlord_id, monthly_rent_cents')
    .in('id', uniquePids)
    .eq('landlord_id', landlordId)
  const propList = (properties ?? []) as Array<{ id: string; landlord_id: string; monthly_rent_cents?: number | null }>
  if (propList.length === 0) return []

  const landlordIds = [...new Set(propList.map((p) => p.landlord_id))]
  const { data: landlordRows } = await admin
    .from('landlord_questionnaire')
    .select('user_id, answers, policy_strictness_score, risk_tolerance_score, conflict_style_score')
    .in('user_id', landlordIds)
  type LRow = {
    user_id: string
    answers: Record<string, unknown>
    policy_strictness_score?: number
    risk_tolerance_score?: number
    conflict_style_score?: number
  }
  const landlordByUserId = new Map<string, LRow>()
  ;(landlordRows ?? []).forEach((r: LRow) => landlordByUserId.set(r.user_id, r))

  const { data: tenantRows } = await admin
    .from('tenant_questionnaire')
    .select(
      'user_id, answers, overall_score, affordability_score, stability_score, payment_risk_score, lifestyle_score',
    )
    .order('updated_at', { ascending: false })
    .limit(450)

  type TQ = {
    user_id: string
    answers?: Record<string, unknown>
    overall_score?: number | null
    affordability_score?: number | null
    stability_score?: number | null
    payment_risk_score?: number | null
    lifestyle_score?: number | null
  }
  const tqList = (tenantRows ?? []) as TQ[]
  if (tqList.length === 0) return []

  const tids = tqList.map((t) => t.user_id)
  const { data: profileRows } = await admin
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', tids)
    .eq('role', 'tenant')

  const tenantProfileById = new Map<string, { display_name: string | null; avatar_url: string | null }>()
  for (const p of profileRows ?? []) {
    const row = p as { id: string; display_name?: string | null; avatar_url?: string | null }
    tenantProfileById.set(row.id, {
      display_name: row.display_name ?? null,
      avatar_url: row.avatar_url ?? null,
    })
  }

  const nowIso = new Date().toISOString()
  const { data: invites } = await admin
    .from('tenant_invite_restrictions')
    .select('tenant_id, landlord_id')
    .in('tenant_id', tids)
    .gt('ends_at', nowIso)

  const inviteLandlordByTenant = new Map<string, string>()
  for (const inv of invites ?? []) {
    const row = inv as { tenant_id: string; landlord_id: string }
    inviteLandlordByTenant.set(row.tenant_id, row.landlord_id)
  }

  const out: LandlordCatalogRowOut[] = []

  for (const prop of propList) {
    const landlordRow = landlordByUserId.get(prop.landlord_id)
    let landlordPrefs: ReturnType<typeof landlordAnswersToPrefs> | null = null
    if (landlordRow) {
      landlordPrefs = landlordAnswersToPrefs(landlordRow.answers ?? {})
      landlordPrefs = {
        ...landlordPrefs,
        policyStrictnessScore: landlordRow.policy_strictness_score ?? landlordPrefs.policyStrictnessScore,
        riskToleranceScore: landlordRow.risk_tolerance_score ?? landlordPrefs.riskToleranceScore,
        conflictStyleScore: landlordRow.conflict_style_score ?? landlordPrefs.conflictStyleScore,
      }
    }

    const candidates: LandlordCatalogRowOut[] = []

    for (const tenantData of tqList) {
      const tid = tenantData.user_id
      if (!tenantProfileById.has(tid)) continue

      const inviteLandlordId = inviteLandlordByTenant.get(tid) ?? null
      if (inviteLandlordId != null && prop.landlord_id !== inviteLandlordId) continue

      const tenantAnswers = tenantData.answers ?? {}
      const tenantHistory = tenantAnswersToHistory(tenantAnswers)
      const tenantMonthlyIncome = typeof tenantAnswers.monthly_income === 'number' ? tenantAnswers.monthly_income : null
      const fallbackAffordability = Number(tenantData.affordability_score) ?? 5
      const rentDollars = (prop.monthly_rent_cents != null ? Number(prop.monthly_rent_cents) : 0) / 100
      const affordability =
        tenantMonthlyIncome != null && tenantMonthlyIncome > 0 && rentDollars > 0
          ? scoreRentToIncome(rentDollars, tenantMonthlyIncome)
          : fallbackAffordability
      const tenantDims = {
        affordability,
        stability: Number(tenantData.stability_score) ?? 5,
        paymentRisk: Number(tenantData.payment_risk_score) ?? 5,
        lifestyle: Number(tenantData.lifestyle_score) ?? 5,
      }
      const tenantScore = tenantDisplayScoreFromQuestionnaire(tenantData)

      let m: MatchResult & { tenantScore?: number | null }
      if (!landlordPrefs) {
        m = {
          eligible: true,
          reasons: [],
          overall: 50,
          dimensions: {
            affordability: tenantDims.affordability,
            stability: tenantDims.stability,
            risk: 5,
            lifestyle: 5,
            policy: 5,
          },
          tenantScore,
        }
      } else {
        const prefsWithScores = {
          ...landlordPrefs,
          policyStrictnessScore: landlordRow?.policy_strictness_score ?? landlordPrefs.policyStrictnessScore,
          riskToleranceScore: landlordRow?.risk_tolerance_score ?? landlordPrefs.riskToleranceScore,
          conflictStyleScore: landlordRow?.conflict_style_score ?? landlordPrefs.conflictStyleScore,
        }
        m = { ...computeMatch(tenantDims, prefsWithScores, tenantHistory), tenantScore }
      }

      const prof = tenantProfileById.get(tid)!
      candidates.push({
        propertyId: prop.id,
        tenantId: tid,
        match: m,
        name: prof.display_name?.trim() || 'Tenant',
        avatarUrl: prof.avatar_url ?? null,
      })
    }

    candidates.sort((a, b) => (b.match.overall ?? 0) - (a.match.overall ?? 0))
    out.push(...candidates.slice(0, limitPerProperty))
  }

  return out
}

/** Mirrors landlord_tenant_universal_application RPC eligibility (SECURITY DEFINER checks). */
async function landlordMayReadTenantUniversalViaDb(
  admin: SupabaseClient,
  landlordId: string,
  tenantId: string,
): Promise<boolean> {
  const nowIso = new Date().toISOString()
  const [threads, ratings, invites, apps] = await Promise.all([
    admin.from('message_threads').select('id').eq('tenant_id', tenantId).eq('landlord_id', landlordId).limit(1),
    admin
      .from('tenant_ratings')
      .select('id')
      .eq('landlord_id', landlordId)
      .or(`tenant_external_id.eq.${tenantId},tenant_id.eq.${tenantId}`)
      .limit(1),
    admin
      .from('tenant_invite_restrictions')
      .select('tenant_id')
      .eq('tenant_id', tenantId)
      .eq('landlord_id', landlordId)
      .gt('ends_at', nowIso)
      .limit(1),
    admin
      .from('applications')
      .select('id, property:property_id(landlord_id)')
      .eq('tenant_id', tenantId)
      .limit(50),
  ])
  if ((threads.data?.length ?? 0) > 0 || (ratings.data?.length ?? 0) > 0 || (invites.data?.length ?? 0) > 0) {
    return true
  }
  for (const row of apps.data ?? []) {
    const prop = row.property as { landlord_id?: string } | { landlord_id?: string }[] | null
    const p = Array.isArray(prop) ? prop[0] : prop
    if (p?.landlord_id === landlordId) return true
  }
  return false
}

async function landlordMayReadTenantUniversalViaCatalog(
  admin: SupabaseClient,
  landlordId: string,
  tenantId: string,
): Promise<boolean> {
  const { data: props } = await admin.from('properties').select('id').eq('landlord_id', landlordId)
  const pids = (props ?? []).map((p: { id: string }) => p.id)
  if (pids.length === 0) return false
  const rows = await buildLandlordCatalogRows(admin, landlordId, pids, 100)
  return rows.some((r) => r.tenantId === tenantId)
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true })
})

// TEMP diagnostic: shows which host headers the deployment receives so we can
// confirm subdomain (host-based) routing. Safe to remove once verified.
app.get('/api/__hostcheck', (req, res) => {
  res.json({
    host: req.headers.host || null,
    xForwardedHost: req.headers['x-forwarded-host'] || null,
    forwarded: req.headers['forwarded'] || null,
  })
})

// RentCast rental value estimate, used by the standalone "Rental Value Report"
// lead-magnet page served at /rental-value-report/. The API key stays server-side.
const RENTCAST_API_KEY = process.env.RENTCAST_API_KEY
const LEAD_WEBHOOK_URL = process.env.LEAD_WEBHOOK_URL
const LEADS_FILE = path.resolve(process.cwd(), 'leads.ndjson')
// HubSpot mirror of each lead (marketing CRM). These are public, embeddable IDs
// (portal + form GUID), not secrets, so they have safe defaults but can be
// overridden via env if the form/account changes.
const HUBSPOT_PORTAL_ID = process.env.HUBSPOT_PORTAL_ID || '245183301'
const HUBSPOT_FORM_GUID = process.env.HUBSPOT_FORM_GUID || '7054444a-a19c-454d-818b-c78342341af0'

function appendLeadToFile(record: Record<string, unknown>) {
  fs.appendFile(LEADS_FILE, JSON.stringify(record) + '\n', (err) => {
    if (err) console.error('Failed to append lead:', err.message)
  })
}

// Mirror a Rental Value Report lead into HubSpot via the public Forms Submission
// API (no auth required — the portal + form GUID are the same IDs used to embed
// the form). This records a submission against the form (so HubSpot lists /
// workflows fire) and creates/updates the contact. Best-effort: never throws.
async function syncLeadToHubSpot(record: Record<string, unknown>) {
  if (!HUBSPOT_PORTAL_ID || !HUBSPOT_FORM_GUID) return
  if (!record.email) return // HubSpot forms require an email to create the contact

  const summary: string[] = []
  if (record.propertyType) summary.push(`Property type: ${record.propertyType}`)
  if (record.bedrooms != null) summary.push(`Bedrooms: ${record.bedrooms}`)
  if (record.bathrooms != null) summary.push(`Bathrooms: ${record.bathrooms}`)
  if (record.squareFootage != null) summary.push(`Square footage: ${record.squareFootage}`)
  if (record.rent != null) {
    const range =
      record.rentRangeLow != null && record.rentRangeHigh != null
        ? ` (range $${record.rentRangeLow}\u2013$${record.rentRangeHigh})`
        : ''
    summary.push(`Estimated rent: $${record.rent}${range}`)
  }

  const fields: Array<{ name: string; value: string }> = []
  const add = (name: string, value: unknown) => {
    if (value != null && String(value).trim() !== '') fields.push({ name, value: String(value) })
  }
  add('email', record.email)
  add('address', record.address)
  add('property_type', record.propertyType)
  add('bedrooms', record.bedrooms)
  add('bathrooms', record.bathrooms)
  add('square_footage', record.squareFootage)
  if (summary.length) add('message', summary.join(' | '))

  const url = `https://api.hsforms.com/submissions/v3/integration/submit/${HUBSPOT_PORTAL_ID}/${HUBSPOT_FORM_GUID}`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 3000)
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, context: { pageName: 'Rental Value Report' } }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('HubSpot lead sync failed:', res.status, detail.slice(0, 300))
    }
  } catch (err) {
    console.error('HubSpot lead sync error:', err instanceof Error ? err.message : String(err))
  } finally {
    clearTimeout(timeout)
  }
}

async function captureLead(record: Record<string, unknown>) {
  const admin = getSupabaseAdmin()
  if (admin) {
    const { error } = await admin.from('leads').insert({
      source: 'rental_value_report',
      email: record.email ?? null,
      address: record.address,
      property_type: record.propertyType ?? null,
      bedrooms: record.bedrooms ?? null,
      bathrooms: record.bathrooms ?? null,
      square_footage: record.squareFootage ?? null,
      rent: record.rent ?? null,
      rent_range_low: record.rentRangeLow ?? null,
      rent_range_high: record.rentRangeHigh ?? null,
    })
    if (error) {
      console.error('Failed to insert lead:', error.message)
      appendLeadToFile(record)
    }
  } else {
    appendLeadToFile(record)
  }
  if (LEAD_WEBHOOK_URL) {
    fetch(LEAD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    }).catch((err) => console.error('Webhook POST failed:', err.message))
  }
  await syncLeadToHubSpot(record)
}

// Best-effort GET against the RentCast API. Returns parsed JSON, or null on any
// non-2xx / network / timeout error so each enrichment call can fail in
// isolation without breaking the core rent estimate.
async function rentcastGet(pathAndQuery: string): Promise<any | null> {
  if (!RENTCAST_API_KEY) return null
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 9000)
  try {
    const res = await fetch('https://api.rentcast.io/v1' + pathAndQuery, {
      method: 'GET',
      headers: { 'X-Api-Key': RENTCAST_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!res.ok) return null
    return await res.json().catch(() => null)
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

function formatUSD(n: number): string {
  return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Absolute origin for shareable report links (used in the emailed CTA, which
// must be absolute to work in real inboxes). Branded reports always live on the
// value.* subdomain of the primary domain, so any gorentalcity.com host is
// normalized to https://value.gorentalcity.com. Otherwise prefers
// PUBLIC_BASE_URL, then the proxied request host, then the Replit dev domain.
// Returns '' if none known.
function getReportBaseUrl(req: express.Request): string {
  const rawHost = (req.headers['x-forwarded-host'] || req.headers['host']) as string | undefined
  const host = rawHost ? String(rawHost).split(',')[0].trim() : undefined
  const hostname = host ? host.split(':')[0].toLowerCase() : undefined
  if (hostname && (hostname === 'gorentalcity.com' || hostname.endsWith('.gorentalcity.com'))) {
    return 'https://value.gorentalcity.com'
  }
  const env = process.env.PUBLIC_BASE_URL
  if (env) return env.replace(/\/+$/, '')
  const proto = ((req.headers['x-forwarded-proto'] as string | undefined) || 'https').split(',')[0]
  if (host) return `${proto}://${host}`
  if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`
  return ''
}

app.get('/api/estimate/health', (_req, res) => {
  res.json({ ok: true, hasKey: Boolean(RENTCAST_API_KEY) })
})

// Serve a stored, fully-rendered rental analysis report as a standalone HTML
// page. Lives under /api so it is proxied in dev, excluded from the prod SPA
// fallback, and skipped by the subdomain-rewrite middleware.
app.get('/api/reports/:id', async (req, res) => {
  const id = String(req.params.id || '')
  if (!/^[0-9a-fA-F-]{36}$/.test(id)) return res.status(404).send('Not found')
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(503).send('Report storage unavailable')
  const { data, error } = await admin
    .from('rental_reports')
    .select('html')
    .eq('id', id)
    .maybeSingle()
  if (error || !data || !data.html) return res.status(404).send('Report not found')
  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=3600')
  return res.send(data.html as string)
})

app.post('/api/estimate', async (req, res) => {
  const body = req.body || {}
  const { address, propertyType, bedrooms, bathrooms, squareFootage, email } = body

  if (!address || String(address).trim().length === 0) {
    return res.status(400).json({ error: 'missing_address' })
  }

  if (!RENTCAST_API_KEY) {
    return res.status(503).json({ error: 'missing_api_key' })
  }

  const qs = new URLSearchParams()
  qs.set('address', String(address))
  if (propertyType) qs.set('propertyType', String(propertyType))
  if (bedrooms != null && bedrooms !== '') qs.set('bedrooms', String(bedrooms))
  if (bathrooms != null && bathrooms !== '') qs.set('bathrooms', String(bathrooms))
  if (squareFootage != null && squareFootage !== '') qs.set('squareFootage', String(squareFootage))
  qs.set('compCount', '12')

  const url = 'https://api.rentcast.io/v1/avm/rent/long-term?' + qs.toString()

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12000)
  try {
    const rcRes = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': RENTCAST_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    })
    const data = (await rcRes.json().catch(() => ({}))) as Record<string, unknown>

    if (!rcRes.ok) {
      return res.status(rcRes.status).json(data)
    }

    await captureLead({
      timestamp: new Date().toISOString(),
      email: email || null,
      address: String(address),
      propertyType: propertyType || null,
      bedrooms: bedrooms != null ? bedrooms : null,
      bathrooms: bathrooms != null ? bathrooms : null,
      squareFootage: squareFootage != null ? squareFootage : null,
      rent: data.rent != null ? data.rent : null,
      rentRangeLow: data.rentRangeLow != null ? data.rentRangeLow : null,
      rentRangeHigh: data.rentRangeHigh != null ? data.rentRangeHigh : null,
    })

    // --- Enrich the bare rent estimate into a full professional analysis. Each
    // call is independent and resilient: any failure simply omits that section.
    const rentNum = Number(data.rent)
    if (!Number.isFinite(rentNum) || rentNum <= 0) {
      return res.json(data)
    }

    const valueQs = new URLSearchParams()
    valueQs.set('address', String(address))
    if (propertyType) valueQs.set('propertyType', String(propertyType))
    if (bedrooms != null && bedrooms !== '') valueQs.set('bedrooms', String(bedrooms))
    if (bathrooms != null && bathrooms !== '') valueQs.set('bathrooms', String(bathrooms))
    if (squareFootage != null && squareFootage !== '') valueQs.set('squareFootage', String(squareFootage))

    const [propsRes, valueRes] = await Promise.all([
      rentcastGet('/properties?' + new URLSearchParams({ address: String(address) }).toString()),
      rentcastGet('/avm/value/long-term?' + valueQs.toString()),
    ])

    const propRecord =
      (Array.isArray(propsRes) ? propsRes[0] : propsRes && typeof propsRes === 'object' ? propsRes : null) || null

    const zipMatch = String(address).match(/\b(\d{5})(?:-\d{4})?\b/)
    const zipFinal = (propRecord && propRecord.zipCode) || (zipMatch ? zipMatch[1] : null)
    const marketRes = zipFinal
      ? await rentcastGet('/markets?zipCode=' + encodeURIComponent(String(zipFinal)) + '&dataType=All')
      : null

    // Comparables come from the rent AVM response.
    const rawComps: any[] = Array.isArray(data.comparables) ? (data.comparables as any[]) : []
    const comparables: ReportComparable[] = rawComps.map((c) => ({
      formattedAddress: c.formattedAddress,
      propertyType: c.propertyType,
      bedrooms: c.bedrooms,
      bathrooms: c.bathrooms,
      squareFootage: c.squareFootage,
      price: c.price,
      distance: c.distance,
      daysOld: c.daysOld,
      correlation: c.correlation,
    }))
    const compCount = comparables.length

    const property = propRecord
      ? {
          propertyType: propRecord.propertyType ?? (propertyType || null),
          bedrooms: propRecord.bedrooms ?? (bedrooms != null && bedrooms !== '' ? Number(bedrooms) : null),
          bathrooms: propRecord.bathrooms ?? (bathrooms != null && bathrooms !== '' ? Number(bathrooms) : null),
          squareFootage:
            propRecord.squareFootage ?? (squareFootage != null && squareFootage !== '' ? Number(squareFootage) : null),
          lotSize: propRecord.lotSize ?? null,
          yearBuilt: propRecord.yearBuilt ?? null,
        }
      : null

    const rd = marketRes && marketRes.rentalData ? marketRes.rentalData : null
    let yoyChange: number | null = null
    if (rd && rd.history && typeof rd.history === 'object') {
      const keys = Object.keys(rd.history).sort()
      if (keys.length >= 13) {
        const latest = rd.history[keys[keys.length - 1]]?.averageRent
        const prior = rd.history[keys[keys.length - 13]]?.averageRent
        if (latest && prior) yoyChange = +(((latest - prior) / prior) * 100).toFixed(1)
      }
    }
    const market = rd
      ? {
          averageRent: rd.averageRent ?? null,
          medianRent: rd.medianRent ?? null,
          averageRentPerSqft: rd.averageRentPerSquareFoot ?? null,
          averageDaysOnMarket: rd.averageDaysOnMarket ?? null,
          yoyChange,
          activeRentals: rd.totalListings ?? null,
          zipCode: (marketRes && marketRes.zipCode) || zipFinal || null,
        }
      : null

    const value = valueRes && valueRes.price != null ? { price: Number(valueRes.price) } : null

    const usedSqft =
      squareFootage != null && squareFootage !== ''
        ? Number(squareFootage)
        : property && property.squareFootage != null
          ? Number(property.squareFootage)
          : null
    const low = data.rentRangeLow != null ? Number(data.rentRangeLow) : Math.round(rentNum * 0.93)
    const high = data.rentRangeHigh != null ? Number(data.rentRangeHigh) : Math.round(rentNum * 1.07)
    const rentPerSqft = usedSqft ? +(rentNum / usedSqft).toFixed(2) : null
    const annualGross = Math.round(rentNum * 12)
    const grossYield = value && value.price ? +(((rentNum * 12) / value.price) * 100).toFixed(1) : null
    const spreadPct = rentNum ? ((high - low) / rentNum) * 100 : 12
    let confidence = Math.round(96 - spreadPct * 1.1 + Math.min(compCount, 20) * 0.25)
    confidence = Math.max(72, Math.min(97, confidence))

    const reportData: ReportData = {
      rent: rentNum,
      rentRangeLow: low,
      rentRangeHigh: high,
      comparables,
      property,
      market,
      value,
      rentPerSqft,
      annualGross,
      grossYield,
      confidence,
      compCount,
    }
    const reportInput = {
      address: String(address),
      propertyType: propertyType || null,
      bedrooms: bedrooms != null && bedrooms !== '' ? Number(bedrooms) : null,
      bathrooms: bathrooms != null && bathrooms !== '' ? Number(bathrooms) : null,
      squareFootage: usedSqft,
      email: email || null,
    }

    const reportId = randomUUID()
    const reportUrl = '/api/reports/' + reportId
    const baseUrl = getReportBaseUrl(req)
    const reportUrlAbs = baseUrl ? baseUrl + reportUrl : reportUrl
    let stored = false
    try {
      const { reportHtml, emailHtml, summary } = buildReport(reportInput, reportData, {
        reportUrl: reportUrlAbs,
      })

      const admin = getSupabaseAdmin()
      if (admin) {
        const { error: storeErr } = await admin.from('rental_reports').insert({
          id: reportId,
          html: reportHtml,
          summary,
          address: String(address),
          email: email || null,
        })
        if (storeErr) {
          console.error('Failed to store rental report:', storeErr.message)
        } else {
          stored = true
        }
      }

      if (stored && email) {
        // Fire-and-forget: never block the response on email delivery.
        sendReportEmail({
          to: String(email),
          subject: `Your rental analysis for ${address} — est. ${formatUSD(rentNum)}/mo`,
          html: emailHtml,
        }).catch((e) => console.error('Report email error:', e instanceof Error ? e.message : String(e)))
      }

      return res.json({
        ...data,
        comparables,
        summary: { ...summary, reportUrl: stored ? reportUrl : null },
        reportUrl: stored ? reportUrl : null,
      })
    } catch (buildErr) {
      console.error('Report build failed:', buildErr instanceof Error ? buildErr.message : String(buildErr))
      return res.json(data)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('RentCast request failed:', message)
    return res.status(502).json({ error: 'rentcast_request_failed', detail: message })
  } finally {
    clearTimeout(timeout)
  }
})

/**
 * Address search/autocomplete backed by the RentCast property records API.
 * Returns canonical, matchable address suggestions for the typed query.
 */
app.get('/api/address-search', async (req, res) => {
  const q = String(req.query.q || '').trim()
  if (!RENTCAST_API_KEY) return res.json({ suggestions: [] })
  if (q.length < 5) return res.json({ suggestions: [] })

  const url =
    'https://api.rentcast.io/v1/properties?address=' + encodeURIComponent(q) + '&limit=5'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const rcRes = await fetch(url, {
      method: 'GET',
      headers: { 'X-Api-Key': RENTCAST_API_KEY, Accept: 'application/json' },
      signal: controller.signal,
    })

    // 400 (unparseable/partial address) and 404 (no record) are normal while
    // typing — treat both as "no suggestions yet" rather than an error.
    if (rcRes.status === 400 || rcRes.status === 404) return res.json({ suggestions: [] })
    if (!rcRes.ok) return res.status(502).json({ suggestions: [], error: 'rentcast_request_failed' })

    const data = await rcRes.json().catch(() => null)
    const arr = Array.isArray(data) ? data : data ? [data] : []
    const suggestions = arr
      .filter((p: any) => p && typeof p.formattedAddress === 'string')
      .map((p: any) => ({
        address: p.formattedAddress as string,
        city: p.city ?? null,
        state: p.state ?? null,
        zipCode: p.zipCode ?? null,
        propertyType: p.propertyType ?? null,
        bedrooms: p.bedrooms ?? null,
        bathrooms: p.bathrooms ?? null,
        squareFootage: p.squareFootage ?? null,
      }))

    return res.json({ suggestions })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('RentCast address search failed:', message)
    return res.status(502).json({ suggestions: [], error: 'rentcast_request_failed' })
  } finally {
    clearTimeout(timeout)
  }
})

/**
 * Tenant-only: load landlord profile for a listing the tenant can see.
 * This avoids client-side RLS edge cases while still enforcing access rules.
 */
app.get('/api/tenant/landlord-profile', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const propertyId = typeof req.query.propertyId === 'string' ? req.query.propertyId : null
  const landlordId = typeof req.query.landlordId === 'string' ? req.query.landlordId : null
  if (!propertyId && !landlordId) return res.status(400).json({ error: 'Missing propertyId or landlordId' })
  if (propertyId && !UUID_PARAM_RE.test(propertyId)) return res.status(400).json({ error: 'Invalid propertyId' })
  if (landlordId && !UUID_PARAM_RE.test(landlordId)) return res.status(400).json({ error: 'Invalid landlordId' })

  let resolvedLandlordId = landlordId
  if (!resolvedLandlordId && propertyId) {
    const { data: prop } = await admin.from('properties').select('id, landlord_id, status').eq('id', propertyId).maybeSingle()
    const p = prop as { landlord_id?: string; status?: string } | null
    if (!p?.landlord_id) return res.status(404).json({ error: 'Property not found' })

    // Enforce access: tenant can view landlord profile if the listing is active OR the tenant is in invited guest mode for that landlord.
    const nowIso = new Date().toISOString()
    const { data: invite } = await admin
      .from('tenant_invite_restrictions')
      .select('landlord_id, ends_at')
      .eq('tenant_id', user.id)
      .gt('ends_at', nowIso)
      .maybeSingle()
    const inviteLandlordId = (invite as { landlord_id?: string } | null)?.landlord_id ?? null

    const status = String(p.status ?? '').toLowerCase()
    const isActive = status === 'active'
    const invitedForThisLandlord = inviteLandlordId != null && inviteLandlordId === p.landlord_id
    if (!isActive && !invitedForThisLandlord) {
      return res.status(403).json({ error: 'Forbidden' })
    }

    resolvedLandlordId = p.landlord_id
  }

  if (!resolvedLandlordId) return res.status(400).json({ error: 'Could not resolve landlordId' })

  const { data: profile } = await admin
    .from('profiles')
    .select('display_name, avatar_url, phone, bio, city, created_at')
    .eq('id', resolvedLandlordId)
    .maybeSingle()

  if (!profile) return res.status(404).json({ error: 'Landlord not found' })
  return res.json({ profile })
})

// One-time tenant application fee (cents): flat $50, good for a 6-month window.
const UNIVERSAL_APP_FEE_CENTS: number[] = [5000]
// Landlord one-time fee to view a tenant's full profile (background/credit): $200.
const LANDLORD_PROFILE_UNLOCK_CENTS = 20000
// Landlord annual membership (auto-renewing subscription): $350/year.
const LANDLORD_ANNUAL_CENTS = 35000

/**
 * Shared, idempotent activation for a paid universal application window.
 * Keyed on the Stripe PaymentIntent id (payments.stripe_payment_intent_id is UNIQUE),
 * so the confirm endpoint and the webhook can both run without double-activating.
 */
async function activateUniversalApplicationPaid(
  admin: SupabaseClient,
  params: { tenantId: string; paymentIntentId: string; amountCents: number; description: string },
): Promise<{ universalApplicationId: string | null; alreadyProcessed: boolean }> {
  const { tenantId, paymentIntentId, amountCents, description } = params

  async function currentActiveId(): Promise<string | null> {
    const { data } = await admin
      .from('universal_applications')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data as { id?: string } | null)?.id ?? null
  }

  // Expire any currently-active window, then open a fresh 6-month one.
  async function openWindow(): Promise<string | null> {
    await admin
      .from('universal_applications')
      .update({ status: 'expired' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')

    const validUntil = new Date()
    validUntil.setMonth(validUntil.getMonth() + 6)

    const { data: inserted, error: insertError } = await admin
      .from('universal_applications')
      .insert({ tenant_id: tenantId, status: 'active', valid_until: validUntil.toISOString() })
      .select('id')
      .maybeSingle()
    if (insertError) throw new Error(insertError.message)
    return (inserted as { id?: string } | null)?.id ?? null
  }

  // Payment already recorded => activation ran (or partially ran) before. Return
  // the active window, repairing it if a prior attempt recorded the payment but
  // failed to open the window, so a paid tenant is never left without access.
  async function resolveAlreadyPaid(): Promise<{ universalApplicationId: string | null; alreadyProcessed: boolean }> {
    const activeId = await currentActiveId()
    return { universalApplicationId: activeId ?? (await openWindow()), alreadyProcessed: true }
  }

  const { data: existingPayment } = await admin
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (existingPayment) {
    return resolveAlreadyPaid()
  }

  const { error: paymentError } = await admin.from('payments').insert({
    application_id: null,
    stripe_payment_intent_id: paymentIntentId,
    amount_cents: amountCents,
    currency: 'usd',
    status: 'succeeded',
    payer_id: tenantId,
    description,
  })
  if (paymentError) {
    // Unique violation => a concurrent confirm/webhook already recorded this payment.
    if ((paymentError as { code?: string }).code === '23505') {
      return resolveAlreadyPaid()
    }
    throw new Error(paymentError.message)
  }

  return { universalApplicationId: await openWindow(), alreadyProcessed: false }
}

/**
 * Create a Stripe Checkout Session for the tenant's one-time universal application fee.
 * Flat $50, whether it is a first application or a renewal after the 6-month window.
 */
app.post('/api/stripe/universal-application/checkout', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const stripe = getStripe()
  if (!stripe) return res.status(500).json({ error: 'Payments are not configured' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { tenantId } = req.body as { tenantId?: string }
  if (!tenantId || tenantId !== user.id) {
    return res.status(400).json({ error: 'Invalid request: tenantId must match authenticated user' })
  }

  const nowIso = new Date().toISOString()
  const { data: active } = await admin
    .from('universal_applications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .gt('valid_until', nowIso)
    .limit(1)
  const hasExisting = (active ?? []).length > 0
  const amountCents = 5000

  const origin =
    req.headers.origin ||
    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : '')
  if (!origin) return res.status(500).json({ error: 'Unable to determine return URL' })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email ?? undefined,
      client_reference_id: tenantId,
      metadata: { tenantId, kind: 'universal_application', hasExisting: String(hasExisting) },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: amountCents,
            product_data: {
              name: hasExisting ? 'Universal Application Renewal' : 'Universal Application',
              description: hasExisting
                ? 'Refresh your background and credit checks for another 6 months.'
                : 'Background check, credit report, and 6 months of unlimited property applications.',
            },
          },
        },
      ],
      success_url: `${origin}/applications/apply?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/applications/apply?checkout=cancel`,
    })
    return res.json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' })
  }
})

/**
 * Confirm a completed Checkout Session on return from Stripe and activate the
 * universal application window. Idempotent; safe to call alongside the webhook.
 */
app.post('/api/stripe/universal-application/confirm', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const stripe = getStripe()
  if (!stripe) return res.status(500).json({ error: 'Payments are not configured' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { sessionId } = req.body as { sessionId?: string }
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return res.status(400).json({ error: 'Invalid checkout session' })
  }

  if (session.metadata?.kind !== 'universal_application') {
    return res.status(400).json({ error: 'This checkout session is not a universal application payment.' })
  }
  if (session.metadata?.tenantId !== user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (session.payment_status !== 'paid') {
    return res.status(402).json({ error: 'Payment has not completed yet.' })
  }

  const amountTotal = session.amount_total
  if (typeof amountTotal !== 'number' || !UNIVERSAL_APP_FEE_CENTS.includes(amountTotal)) {
    return res.status(400).json({ error: 'Unexpected payment amount.' })
  }

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId) return res.status(400).json({ error: 'No payment found for this session' })

  const hasExisting = session.metadata?.hasExisting === 'true'
  try {
    const result = await activateUniversalApplicationPaid(admin, {
      tenantId: user.id,
      paymentIntentId,
      amountCents: amountTotal,
      description: hasExisting ? 'Universal application renewal' : 'Universal application activation',
    })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Activation failed' })
  }
})

/**
 * Idempotent activation for a paid landlord profile-unlock ($200). Keyed on the
 * Stripe PaymentIntent id (payments.stripe_payment_intent_id is UNIQUE), so the
 * confirm endpoint and the webhook can both run without double-charging or
 * double-unlocking.
 */
async function activateLandlordProfileUnlockPaid(
  admin: SupabaseClient,
  params: { landlordId: string; applicationId: string; paymentIntentId: string; amountCents: number },
): Promise<{ unlocked: boolean; alreadyProcessed: boolean }> {
  const { landlordId, applicationId, paymentIntentId, amountCents } = params

  async function ensureUnlocked(): Promise<void> {
    await admin
      .from('applications')
      .update({ unlocked_at: new Date().toISOString() })
      .eq('id', applicationId)
      .is('unlocked_at', null)
  }

  const { data: existingPayment } = await admin
    .from('payments')
    .select('id')
    .eq('stripe_payment_intent_id', paymentIntentId)
    .maybeSingle()
  if (existingPayment) {
    await ensureUnlocked()
    return { unlocked: true, alreadyProcessed: true }
  }

  const { error: paymentError } = await admin.from('payments').insert({
    application_id: applicationId,
    stripe_payment_intent_id: paymentIntentId,
    amount_cents: amountCents,
    currency: 'usd',
    status: 'succeeded',
    payer_id: landlordId,
    description: 'Landlord full tenant profile access',
  })
  if (paymentError) {
    if ((paymentError as { code?: string }).code === '23505') {
      await ensureUnlocked()
      return { unlocked: true, alreadyProcessed: true }
    }
    throw new Error(paymentError.message)
  }

  await ensureUnlocked()
  return { unlocked: true, alreadyProcessed: false }
}

// Verify the authenticated landlord owns the property tied to this application,
// and return the application row (id, status, unlocked_at, tenant_id).
async function loadLandlordApplication(
  admin: SupabaseClient,
  landlordId: string,
  applicationId: string,
): Promise<{ id: string; status: string; unlocked_at: string | null; tenant_id: string } | null> {
  const { data } = await admin
    .from('applications')
    .select('id, status, unlocked_at, tenant_id, property:property_id(landlord_id)')
    .eq('id', applicationId)
    .maybeSingle()
  if (!data) return null
  const row = data as {
    id: string
    status: string
    unlocked_at: string | null
    tenant_id: string
    property: { landlord_id?: string } | { landlord_id?: string }[] | null
  }
  const property = Array.isArray(row.property) ? row.property[0] : row.property
  if (!property || property.landlord_id !== landlordId) return null
  return { id: row.id, status: row.status, unlocked_at: row.unlocked_at, tenant_id: row.tenant_id }
}

/**
 * Create a Stripe Checkout Session for a landlord to unlock (view) a tenant's
 * full profile — background check, credit, contact, etc. One-time $200.
 */
app.post('/api/stripe/landlord/profile-unlock/checkout', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const stripe = getStripe()
  if (!stripe) return res.status(500).json({ error: 'Payments are not configured' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { applicationId } = req.body as { applicationId?: string }
  if (!applicationId) return res.status(400).json({ error: 'Missing applicationId' })

  const application = await loadLandlordApplication(admin, user.id, applicationId)
  if (!application) return res.status(403).json({ error: 'You do not have access to this application.' })
  if (application.unlocked_at) return res.status(409).json({ error: 'This profile is already unlocked.' })
  if (application.status !== 'pending') {
    return res.status(409).json({ error: 'This application is no longer pending.' })
  }

  const origin =
    req.headers.origin ||
    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : '')
  if (!origin) return res.status(500).json({ error: 'Unable to determine return URL' })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { landlordId: user.id, applicationId, tenantId: application.tenant_id, kind: 'landlord_profile_unlock' },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: LANDLORD_PROFILE_UNLOCK_CENTS,
            product_data: {
              name: 'Full Tenant Profile Access',
              description: 'View this tenant\u2019s full profile: background check, credit report, and contact details.',
            },
          },
        },
      ],
      success_url: `${origin}/matches/tenant/${application.tenant_id}?application=${applicationId}&unlock=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/matches/tenant/${application.tenant_id}?application=${applicationId}&unlock=cancel`,
    })
    return res.json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' })
  }
})

/**
 * Confirm a completed profile-unlock Checkout Session on return from Stripe and
 * unlock the tenant's full profile. Idempotent; safe to call alongside the webhook.
 */
app.post('/api/stripe/landlord/profile-unlock/confirm', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const stripe = getStripe()
  if (!stripe) return res.status(500).json({ error: 'Payments are not configured' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { sessionId } = req.body as { sessionId?: string }
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return res.status(400).json({ error: 'Invalid checkout session' })
  }

  if (session.metadata?.kind !== 'landlord_profile_unlock') {
    return res.status(400).json({ error: 'This checkout session is not a profile-unlock payment.' })
  }
  if (session.metadata?.landlordId !== user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  if (session.payment_status !== 'paid') {
    return res.status(402).json({ error: 'Payment has not completed yet.' })
  }
  if (session.amount_total !== LANDLORD_PROFILE_UNLOCK_CENTS) {
    return res.status(400).json({ error: 'Unexpected payment amount.' })
  }

  const applicationId = session.metadata?.applicationId
  if (!applicationId) return res.status(400).json({ error: 'Missing application reference.' })

  const paymentIntentId =
    typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
  if (!paymentIntentId) return res.status(400).json({ error: 'No payment found for this session' })

  try {
    const result = await activateLandlordProfileUnlockPaid(admin, {
      landlordId: user.id,
      applicationId,
      paymentIntentId,
      amountCents: session.amount_total,
    })
    return res.json(result)
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Unlock failed' })
  }
})

// Map a Stripe subscription status to the coarse membership status we store.
function mapSubscriptionStatus(status: string): string {
  if (status === 'active' || status === 'trialing') return 'active'
  if (status === 'past_due' || status === 'unpaid' || status === 'incomplete') return 'past_due'
  return 'canceled'
}

// Retrieve the subscription from Stripe and upsert the landlord's membership row.
async function syncLandlordMembership(
  admin: SupabaseClient,
  stripe: Stripe,
  params: { landlordId: string; subscriptionId: string; customerId: string | null },
): Promise<void> {
  const sub = await stripe.subscriptions.retrieve(params.subscriptionId)
  const currentPeriodEnd =
    typeof sub.current_period_end === 'number'
      ? new Date(sub.current_period_end * 1000).toISOString()
      : null
  await admin
    .from('landlord_memberships')
    .upsert(
      {
        landlord_id: params.landlordId,
        stripe_customer_id: params.customerId,
        stripe_subscription_id: params.subscriptionId,
        status: mapSubscriptionStatus(sub.status),
        current_period_end: currentPeriodEnd,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'landlord_id' },
    )
}

// True when the row represents an active, unexpired membership.
function membershipIsActive(row: { status?: string | null; current_period_end?: string | null } | null): boolean {
  if (!row || row.status !== 'active') return false
  if (!row.current_period_end) return true
  return new Date(row.current_period_end).getTime() > Date.now()
}

/**
 * Return the authenticated landlord's membership status.
 */
app.get('/api/stripe/landlord/membership', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { data } = await admin
    .from('landlord_memberships')
    .select('status, current_period_end')
    .eq('landlord_id', user.id)
    .maybeSingle()
  const row = (data as { status?: string; current_period_end?: string | null } | null) ?? null
  return res.json({ active: membershipIsActive(row), currentPeriodEnd: row?.current_period_end ?? null })
})

/**
 * Create a Stripe Checkout Session (subscription mode) for the landlord's
 * $350/year auto-renewing membership.
 */
app.post('/api/stripe/landlord/membership/checkout', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const stripe = getStripe()
  if (!stripe) return res.status(500).json({ error: 'Payments are not configured' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { data: existing } = await admin
    .from('landlord_memberships')
    .select('status, current_period_end')
    .eq('landlord_id', user.id)
    .maybeSingle()
  if (membershipIsActive(existing as { status?: string; current_period_end?: string | null } | null)) {
    return res.status(409).json({ error: 'You already have an active membership.' })
  }

  const origin =
    req.headers.origin ||
    (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : '')
  if (!origin) return res.status(500).json({ error: 'Unable to determine return URL' })

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: user.email ?? undefined,
      client_reference_id: user.id,
      metadata: { landlordId: user.id, kind: 'landlord_annual' },
      subscription_data: { metadata: { landlordId: user.id, kind: 'landlord_annual' } },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: LANDLORD_ANNUAL_CENTS,
            recurring: { interval: 'year' },
            product_data: {
              name: 'Landlord Annual Membership',
              description: 'List properties and receive tenant matches. Renews automatically each year.',
            },
          },
        },
      ],
      success_url: `${origin}/onboarding/property/intro?membership=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/onboarding/property/intro?membership=cancel`,
    })
    return res.json({ url: session.url })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create checkout session' })
  }
})

/**
 * Confirm a completed membership Checkout Session on return from Stripe and record
 * the landlord's subscription. Idempotent; safe to call alongside the webhook.
 */
app.post('/api/stripe/landlord/membership/confirm', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const stripe = getStripe()
  if (!stripe) return res.status(500).json({ error: 'Payments are not configured' })

  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { sessionId } = req.body as { sessionId?: string }
  if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' })

  let session: Stripe.Checkout.Session
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId)
  } catch {
    return res.status(400).json({ error: 'Invalid checkout session' })
  }

  if (session.metadata?.kind !== 'landlord_annual') {
    return res.status(400).json({ error: 'This checkout session is not a membership payment.' })
  }
  if (session.metadata?.landlordId !== user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }
  const subscriptionId =
    typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
  if (!subscriptionId) return res.status(402).json({ error: 'Subscription has not been created yet.' })
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null

  try {
    await syncLandlordMembership(admin, stripe, { landlordId: user.id, subscriptionId, customerId })
    const { data } = await admin
      .from('landlord_memberships')
      .select('status, current_period_end')
      .eq('landlord_id', user.id)
      .maybeSingle()
    const row = (data as { status?: string; current_period_end?: string | null } | null) ?? null
    return res.json({ active: membershipIsActive(row), currentPeriodEnd: row?.current_period_end ?? null })
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Membership activation failed' })
  }
})

/**
 * Stripe webhook (production reliability backstop). Registered with a raw body
 * parser before express.json(). No-ops gracefully until STRIPE_WEBHOOK_SECRET is set.
 */
async function handleStripeWebhook(req: Request, res: Response) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !webhookSecret) {
    return res.status(200).json({ received: true, skipped: true })
  }

  const sig = req.headers['stripe-signature']
  const signature = Array.isArray(sig) ? sig[0] : sig
  if (!signature) return res.status(400).json({ error: 'Missing signature' })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(req.body as Buffer, signature, webhookSecret)
  } catch {
    return res.status(400).json({ error: 'Webhook signature verification failed' })
  }

  const admin = getSupabaseAdmin()

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session
    const kind = session.metadata?.kind
    const paymentIntentId =
      typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id
    const amountTotal = session.amount_total

    if (
      admin &&
      kind === 'universal_application' &&
      session.metadata?.tenantId &&
      paymentIntentId &&
      session.payment_status === 'paid' &&
      typeof amountTotal === 'number' &&
      UNIVERSAL_APP_FEE_CENTS.includes(amountTotal)
    ) {
      const hasExisting = session.metadata?.hasExisting === 'true'
      try {
        await activateUniversalApplicationPaid(admin, {
          tenantId: session.metadata.tenantId,
          paymentIntentId,
          amountCents: amountTotal,
          description: hasExisting ? 'Universal application renewal' : 'Universal application activation',
        })
      } catch (err) {
        console.error('Stripe webhook activation failed:', err)
        return res.status(500).json({ error: 'Activation failed' })
      }
    } else if (
      admin &&
      kind === 'landlord_profile_unlock' &&
      session.metadata?.landlordId &&
      session.metadata?.applicationId &&
      paymentIntentId &&
      session.payment_status === 'paid' &&
      amountTotal === LANDLORD_PROFILE_UNLOCK_CENTS
    ) {
      try {
        await activateLandlordProfileUnlockPaid(admin, {
          landlordId: session.metadata.landlordId,
          applicationId: session.metadata.applicationId,
          paymentIntentId,
          amountCents: amountTotal,
        })
      } catch (err) {
        console.error('Stripe webhook profile-unlock failed:', err)
        return res.status(500).json({ error: 'Unlock failed' })
      }
    } else if (admin && kind === 'landlord_annual' && session.metadata?.landlordId) {
      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id ?? null
      if (subscriptionId) {
        try {
          await syncLandlordMembership(admin, stripe, {
            landlordId: session.metadata.landlordId,
            subscriptionId,
            customerId,
          })
        } catch (err) {
          console.error('Stripe webhook membership activation failed:', err)
          return res.status(500).json({ error: 'Membership activation failed' })
        }
      }
    }
  } else if (
    admin &&
    (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted')
  ) {
    // Keep membership status in sync with renewals, cancellations, and failed payments.
    const sub = event.data.object as Stripe.Subscription
    const landlordId = sub.metadata?.landlordId
    const currentPeriodEnd =
      typeof sub.current_period_end === 'number' ? new Date(sub.current_period_end * 1000).toISOString() : null
    const status = event.type === 'customer.subscription.deleted' ? 'canceled' : mapSubscriptionStatus(sub.status)
    try {
      if (landlordId) {
        await admin
          .from('landlord_memberships')
          .update({ status, current_period_end: currentPeriodEnd, updated_at: new Date().toISOString() })
          .eq('landlord_id', landlordId)
      } else {
        await admin
          .from('landlord_memberships')
          .update({ status, current_period_end: currentPeriodEnd, updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
      }
    } catch (err) {
      console.error('Stripe webhook subscription sync failed:', err)
      return res.status(500).json({ error: 'Subscription sync failed' })
    }
  }

  return res.status(200).json({ received: true })
}

/**
 * Start (or reuse) a BackgroundChecks.com order for the tenant's latest universal application window.
 * Returns the report_key (used by the applicant form widget).
 */
app.post('/api/background-checks/universal/start', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { universalApplicationId } = req.body as { universalApplicationId?: string }
  if (!universalApplicationId || !UUID_PARAM_RE.test(universalApplicationId)) {
    return res.status(400).json({ error: 'Invalid universalApplicationId' })
  }

  // Confirm this universal application belongs to the tenant.
  const { data: ua } = await admin
    .from('universal_applications')
    .select('id, tenant_id, status, valid_until')
    .eq('id', universalApplicationId)
    .maybeSingle()
  if (!ua || (ua as { tenant_id?: string }).tenant_id !== user.id) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  // Reuse existing screening if present.
  const { data: existing } = await admin
    .from('universal_application_screenings')
    .select('id, report_key, applicant_invite_url, report_status, background_pass, income_pass')
    .eq('tenant_id', user.id)
    .eq('universal_application_id', universalApplicationId)
    .maybeSingle()
  const ex = existing as { report_key?: string; applicant_invite_url?: string } | null
  if (ex?.report_key) {
    return res.json({ reportKey: ex.report_key, inviteUrl: ex.applicant_invite_url ?? null })
  }

  // Place an order for the tenant (one applicant). Use placeholder report_sku until configured.
  const applicantEmail = user.email ?? ''
  if (!applicantEmail) return res.status(400).json({ error: 'Missing tenant email' })

  const reportSku = (process.env.BACKGROUNDCHECKS_REPORT_SKU || 'HIRE3') as 'HIRE1' | 'HIRE2' | 'HIRE3'
  const orderBody = {
    report_sku: reportSku,
    order_quantity: 1,
    applicant_emails: [applicantEmail],
    employment: 'Y', // used as income/employment verification signal
    terms_agree: 'Y',
  }

  try {
    const bcRes = await backgroundChecksFetch('/orders', { method: 'POST', body: JSON.stringify(orderBody) })
    const json = (await bcRes.json()) as {
      applicants?: Array<{ report_key?: string; applicant_invite_url?: string; applicant_email?: string }>
    }
    const first = json.applicants?.[0]
    const reportKey = first?.report_key
    if (!reportKey) return res.status(500).json({ error: 'BackgroundChecks.com did not return a report_key' })

    await admin.from('universal_application_screenings').insert({
      tenant_id: user.id,
      universal_application_id: universalApplicationId,
      provider: 'backgroundchecks_com',
      environment: backgroundChecksEnv === 'production' ? 'production' : 'sandbox',
      report_sku: reportSku,
      applicant_email: first?.applicant_email ?? applicantEmail,
      report_key: reportKey,
      applicant_invite_url: first?.applicant_invite_url ?? null,
      report_status: 'A',
      background_status: 'P',
      employment_status: 'P',
      background_pass: null,
      income_pass: null,
    })

    return res.json({ reportKey, inviteUrl: first?.applicant_invite_url ?? null })
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message })
  }
})

/**
 * Refresh provider status for a report_key and update our summary fields.
 * Allowed for the tenant who owns it, or a landlord allowed to read that tenant's universal application.
 */
app.post('/api/background-checks/report/refresh', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { reportKey } = req.body as { reportKey?: string }
  if (!reportKey || typeof reportKey !== 'string') return res.status(400).json({ error: 'Invalid reportKey' })

  const { data: row } = await admin
    .from('universal_application_screenings')
    .select('id, tenant_id, report_key')
    .eq('report_key', reportKey)
    .maybeSingle()
  const screening = row as { id: string; tenant_id: string; report_key: string } | null
  if (!screening) return res.status(404).json({ error: 'Not found' })

  const isTenant = screening.tenant_id === user.id
  let allowed = isTenant
  if (!allowed) {
    allowed = await landlordMayReadTenantUniversalViaDb(admin, user.id, screening.tenant_id)
  }
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  try {
    const statusRes = await backgroundChecksFetch(`/reports/${encodeURIComponent(reportKey)}/status`, { method: 'GET' })
    const statusJson = (await statusRes.json()) as {
      report_status?: string
      background_status?: string
      employment_status?: string
      status?: string
    }

    // When complete, fetch report details and derive very simple pass/fail signals:
    // - background_pass: true if complete and no criminal record arrays present
    // - income_pass: true if employment section exists and status is complete
    let backgroundPass: boolean | null = null
    let incomePass: boolean | null = null
    let completedAt: string | null = null

    const reportStatus = statusJson.report_status ?? statusJson.status ?? null
    const backgroundStatus = statusJson.background_status ?? null
    const employmentStatus = statusJson.employment_status ?? null

    if (reportStatus === 'C') {
      const reportRes = await backgroundChecksFetch(`/report/${encodeURIComponent(reportKey)}`, { method: 'GET' })
      const report = (await reportRes.json()) as any
      const hasCriminal =
        (report?.criminal_records?.records?.length ?? 0) > 0 ||
        (report?.county_criminal?.county_records?.length ?? 0) > 0 ||
        (report?.federal_criminal?.cases?.length ?? 0) > 0 ||
        (report?.blj?.cases?.length ?? 0) > 0
      backgroundPass = !hasCriminal
      incomePass = report?.employment?.status ? report.employment.status === 'C' : employmentStatus ? employmentStatus === 'C' : null
      completedAt = new Date().toISOString()
    }

    await admin
      .from('universal_application_screenings')
      .update({
        report_status: reportStatus,
        background_status: backgroundStatus,
        employment_status: employmentStatus,
        background_pass: backgroundPass,
        income_pass: incomePass,
        completed_at: completedAt,
      })
      .eq('report_key', reportKey)

    return res.json({
      ok: true,
      reportStatus,
      backgroundStatus,
      employmentStatus,
      backgroundPass,
      incomePass,
    })
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message })
  }
})

app.post('/api/account/delete', async (req, res) => {
  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const supabaseAdmin = getSupabaseAdmin()!
  const { data: { user }, error: getUserError } = await supabaseAdmin.auth.getUser(token)

  if (getUserError || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

  if (deleteError) {
    return res.status(400).json({ error: deleteError.message })
  }

  res.json({ success: true })
})

// Match scores for a tenant viewing properties
app.post('/api/matches/for-tenant', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })
  const { tenantId, propertyIds, limit: limitRaw } = req.body as {
    tenantId?: string
    propertyIds?: string[]
    limit?: unknown
  }
  if (!tenantId || !Array.isArray(propertyIds) || tenantId !== user.id) {
    return res.status(400).json({ error: 'Invalid request: tenantId must match authenticated user' })
  }
  if (propertyIds.length === 0) return res.json({ matches: {} })
  const uniqueIds = [...new Set(propertyIds)]
  const topLimit =
    typeof limitRaw === 'number' && Number.isFinite(limitRaw) && limitRaw > 0
      ? Math.min(250, Math.floor(limitRaw))
      : undefined

  const [tenantRow, propertiesRows, inviteRow] = await Promise.all([
    admin.from('tenant_questionnaire').select('answers, affordability_score, stability_score, payment_risk_score, lifestyle_score').eq('user_id', tenantId).maybeSingle(),
    admin.from('properties').select('id, landlord_id, monthly_rent_cents').in('id', uniqueIds),
    admin.from('tenant_invite_restrictions').select('landlord_id').eq('tenant_id', tenantId).gt('ends_at', new Date().toISOString()).maybeSingle(),
  ])
  const tenantData = tenantRow.data
  const properties = (propertiesRows.data ?? []) as { id: string; landlord_id: string; monthly_rent_cents?: number | null }[]
  const inviteLandlordId = (inviteRow.data as { landlord_id?: string } | null)?.landlord_id ?? null
  if (!tenantData) {
    const empty: Record<string, MatchResult & { tenantScore?: number }> = {}
    uniqueIds.forEach((id) => { empty[id] = { eligible: false, reasons: ['Tenant questionnaire not completed.'], overall: 0, dimensions: { affordability: 0, stability: 0, risk: 0, lifestyle: 0, policy: 0 } } })
    return res.json({ matches: empty })
  }

  const tenantAnswers = (tenantData as { answers?: Record<string, unknown> }).answers ?? {}
  const tenantHistory = tenantAnswersToHistory(tenantAnswers)
  const tenantMonthlyIncome = typeof tenantAnswers.monthly_income === 'number' ? tenantAnswers.monthly_income : null
  const fallbackAffordability = Number(tenantData.affordability_score) ?? 5
  const baseTenantDims = {
    affordability: fallbackAffordability,
    stability: Number(tenantData.stability_score) ?? 5,
    paymentRisk: Number(tenantData.payment_risk_score) ?? 5,
    lifestyle: Number(tenantData.lifestyle_score) ?? 5,
  }
  const landlordIds = [...new Set(properties.map((p) => p.landlord_id))]
  const { data: landlordRows } = await admin.from('landlord_questionnaire').select('user_id, answers, policy_strictness_score, risk_tolerance_score, conflict_style_score').in('user_id', landlordIds)
  type LandlordRow = { user_id: string; answers: Record<string, unknown>; policy_strictness_score?: number; risk_tolerance_score?: number; conflict_style_score?: number }
  const landlordByUserId = new Map<string, LandlordRow>()
  ;(landlordRows ?? []).forEach((r: LandlordRow) => {
    landlordByUserId.set(r.user_id, r)
  })

  const dimZero = { affordability: 0, stability: 0, risk: 0, lifestyle: 0, policy: 0 }
  const matches: Record<string, MatchResult> = {}
  for (const prop of properties) {
    if (inviteLandlordId != null && prop.landlord_id !== inviteLandlordId) {
      matches[prop.id] = {
        eligible: false,
        reasons: ['Only listings from your invited host are available until your invite period ends.'],
        overall: 0,
        dimensions: dimZero,
      }
      continue
    }
    const rentDollars = (prop.monthly_rent_cents != null ? Number(prop.monthly_rent_cents) : 0) / 100
    const affordability = tenantMonthlyIncome != null && tenantMonthlyIncome > 0 && rentDollars > 0
      ? scoreRentToIncome(rentDollars, tenantMonthlyIncome)
      : fallbackAffordability
    const tenantDims = { ...baseTenantDims, affordability }
    const landlord = landlordByUserId.get(prop.landlord_id)
    if (!landlord) {
      matches[prop.id] = { eligible: true, reasons: [], overall: 50, dimensions: { affordability: tenantDims.affordability, stability: tenantDims.stability, risk: 5, lifestyle: 5, policy: 5 } }
      continue
    }
    const prefs = landlordAnswersToPrefs(landlord.answers ?? {})
    const prefsWithScores = {
      ...prefs,
      policyStrictnessScore: landlord.policy_strictness_score ?? prefs.policyStrictnessScore,
      riskToleranceScore: landlord.risk_tolerance_score ?? prefs.riskToleranceScore,
      conflictStyleScore: landlord.conflict_style_score ?? prefs.conflictStyleScore,
    }
    matches[prop.id] = computeMatch(tenantDims, prefsWithScores, tenantHistory)
  }
  for (const id of uniqueIds) {
    if (!matches[id]) matches[id] = { eligible: false, reasons: ['Property not found.'], overall: 0, dimensions: { affordability: 0, stability: 0, risk: 0, lifestyle: 0, policy: 0 } }
  }

  if (topLimit != null) {
    const ranked = uniqueIds
      .map((id) => ({ id, m: matches[id] }))
      .filter((x) => x.m?.eligible === true)
      .sort((a, b) => (b.m.overall ?? 0) - (a.m.overall ?? 0))
      .slice(0, topLimit)
    const trimmed: Record<string, MatchResult> = {}
    for (const { id, m } of ranked) {
      trimmed[id] = m
    }
    return res.json({ matches: trimmed })
  }

  return res.json({ matches })
})

// Match scores for a landlord viewing applicants
app.post('/api/matches/for-landlord', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })
  const { landlordId, tenantIds } = req.body as { landlordId?: string; tenantIds?: string[] }
  if (!landlordId || !Array.isArray(tenantIds) || landlordId !== user.id) {
    return res.status(400).json({ error: 'Invalid request: landlordId must match authenticated user' })
  }
  if (tenantIds.length === 0) return res.json({ matches: {} })
  const uniqueTenantIds = [...new Set(tenantIds)]

  const [landlordRow, tenantRows] = await Promise.all([
    admin.from('landlord_questionnaire').select('answers, policy_strictness_score, risk_tolerance_score, conflict_style_score').eq('user_id', landlordId).maybeSingle(),
    admin.from('tenant_questionnaire').select('user_id, answers, overall_score, affordability_score, stability_score, payment_risk_score, lifestyle_score').in('user_id', uniqueTenantIds),
  ])
  const landlordData = landlordRow.data as { answers?: Record<string, unknown>; policy_strictness_score?: number; risk_tolerance_score?: number; conflict_style_score?: number } | null
  const tenants = (tenantRows.data ?? []) as Array<{ user_id: string; answers?: Record<string, unknown>; overall_score?: number; affordability_score?: number; stability_score?: number; payment_risk_score?: number; lifestyle_score?: number }>

  let landlordPrefs: ReturnType<typeof landlordAnswersToPrefs> | null = null
  if (landlordData) {
    landlordPrefs = landlordAnswersToPrefs(landlordData.answers ?? {})
    landlordPrefs = { ...landlordPrefs, policyStrictnessScore: landlordData.policy_strictness_score ?? landlordPrefs.policyStrictnessScore, riskToleranceScore: landlordData.risk_tolerance_score ?? landlordPrefs.riskToleranceScore }
  }

  const matches: Record<string, MatchResult & { tenantScore?: number | null }> = {}
  for (const t of tenants) {
    const tenantScore = tenantDisplayScoreFromQuestionnaire(t)
    if (!landlordPrefs) {
      matches[t.user_id] = { eligible: true, reasons: [], overall: 50, dimensions: { affordability: 5, stability: 5, risk: 5, lifestyle: 5, policy: 5 }, tenantScore }
      continue
    }
    const tenantDims = {
      affordability: Number(t.affordability_score) ?? 5,
      stability: Number(t.stability_score) ?? 5,
      paymentRisk: Number(t.payment_risk_score) ?? 5,
      lifestyle: Number(t.lifestyle_score) ?? 5,
    }
    const tenantHistory = tenantAnswersToHistory(t.answers ?? {})
    matches[t.user_id] = { ...computeMatch(tenantDims, landlordPrefs, tenantHistory), tenantScore }
  }
  for (const id of uniqueTenantIds) {
    if (!matches[id]) matches[id] = { eligible: false, reasons: ['Tenant questionnaire not found.'], overall: 0, dimensions: { affordability: 0, stability: 0, risk: 0, lifestyle: 0, policy: 0 }, tenantScore: null }
  }
  return res.json({ matches })
})

/** Top tenant–property match candidates for landlord listings (not limited to applicants). */
app.post('/api/matches/landlord-catalog', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const { landlordId, propertyIds, limitPerProperty: limitRaw } = req.body as {
    landlordId?: string
    propertyIds?: string[]
    limitPerProperty?: unknown
  }
  if (!landlordId || !Array.isArray(propertyIds) || landlordId !== user.id) {
    return res.status(400).json({ error: 'Invalid request: landlordId must match authenticated user' })
  }
  const uniquePids = [...new Set(propertyIds)].filter(Boolean) as string[]
  if (uniquePids.length === 0) return res.json({ rows: [] })

  const limitPerProperty = Math.min(
    100,
    Math.max(
      1,
      typeof limitRaw === 'number' && Number.isFinite(limitRaw) ? Math.floor(limitRaw) : 50,
    ),
  )

  const out = await buildLandlordCatalogRows(admin, landlordId, uniquePids, limitPerProperty)
  return res.json({ rows: out })
})

/** Service-role read for landlords who see a tenant as a match prospect (no application/thread yet). */
app.get('/api/landlord/tenant-universal-application/:tenantId', async (req, res) => {
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })
  const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null
  const user = await authUser(token)
  if (!user) return res.status(401).json({ error: 'Authentication required' })

  const tenantId = req.params.tenantId
  if (!tenantId || !UUID_PARAM_RE.test(tenantId)) {
    return res.status(400).json({ error: 'Invalid tenant id' })
  }

  const landlordId = user.id
  const allowed =
    (await landlordMayReadTenantUniversalViaDb(admin, landlordId, tenantId)) ||
    (await landlordMayReadTenantUniversalViaCatalog(admin, landlordId, tenantId))
  if (!allowed) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data: row, error } = await admin
    .from('universal_applications')
    .select('status, valid_until, created_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    return res.status(500).json({ error: 'Failed to load universal application' })
  }
  return res.json({ universalApplication: row ?? null })
})

/** Merged auth users + profiles for admin user management (emails from Auth). */
app.get('/api/admin/directory', async (req, res) => {
  const ok = await requireAdmin(req, res)
  if (ok === null) return
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })

  const { data: listData, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (listErr) {
    return res.status(500).json({ error: listErr.message })
  }
  const users = listData?.users ?? []
  const ids = users.map((u) => u.id)
  if (ids.length === 0) {
    return res.json({ users: [] })
  }

  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, role, display_name, is_suspended, created_at, phone')
    .in('id', ids)

  if (pErr) {
    return res.status(500).json({ error: pErr.message })
  }

  const profById = new Map((profiles ?? []).map((p) => [p.id as string, p]))
  const rows = users.map((u) => {
    const p = profById.get(u.id)
    return {
      id: u.id,
      email: u.email ?? '',
      role: (p?.role as string | undefined) ?? 'tenant',
      display_name: (p?.display_name as string | null | undefined) ?? null,
      is_suspended: Boolean(p?.is_suspended),
      phone: (p?.phone as string | null | undefined) ?? null,
      created_at: (p?.created_at as string | undefined) ?? u.created_at,
    }
  })

  return res.json({ users: rows })
})

// ---------------------------------------------------------------------------
// Plaid: tenant income + bank balance verification
// ---------------------------------------------------------------------------

function plaidUnavailable(res: express.Response) {
  return res.status(503).json({
    error: 'Bank verification is not configured. Add PLAID_CLIENT_ID and PLAID_SECRET to enable it.',
  })
}

async function bearerUser(req: express.Request) {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : null
  return authUser(token)
}

// Exposes ONLY verification signals to the client/landlords. Raw financial
// figures, per-account details, the account-holder name, and contact PII are
// deliberately never surfaced (and are no longer stored — see storeVerification).
function verificationRow(row: {
  institution_name: string | null
  accounts_count: number | null
  income_verified: boolean | null
  balances_verified: boolean | null
  debts_verified?: boolean | null
  dti_ratio?: number | string | null
  identity_verified?: boolean | null
  last_verified_at: string | null
}) {
  const num = (v: number | string | null | undefined) =>
    v === null || v === undefined ? null : Number(v)
  return {
    institutionName: row.institution_name,
    accountsCount: row.accounts_count ?? 0,

    incomeVerified: Boolean(row.income_verified),
    balancesVerified: Boolean(row.balances_verified),
    debtsVerified: Boolean(row.debts_verified),
    dtiRatio: num(row.dti_ratio ?? null),
    identityVerified: Boolean(row.identity_verified),

    lastVerifiedAt: row.last_verified_at,
  }
}

app.post('/api/plaid/link-token/create', async (req, res) => {
  const user = await bearerUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const client = getPlaidClient()
  if (!client) return plaidUnavailable(res)
  try {
    const linkToken = await createLinkToken(client, user.id)
    return res.json({ linkToken })
  } catch (err) {
    const msg = (err as { response?: { data?: { error_message?: string } } })?.response?.data?.error_message
    console.error('Plaid link-token error:', msg || (err as Error)?.message)
    return res.status(502).json({ error: msg || 'Could not start bank connection' })
  }
})

app.post('/api/plaid/exchange', async (req, res) => {
  const user = await bearerUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const client = getPlaidClient()
  if (!client) return plaidUnavailable(res)
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })

  const publicToken = (req.body as { publicToken?: string })?.publicToken
  if (!publicToken) return res.status(400).json({ error: 'Missing publicToken' })

  try {
    const { accessToken, itemId } = await exchangePublicToken(client, publicToken)
    const summary = await fetchFinancialSummary(client, accessToken)
    const env = getPlaidEnv()

    const { error: itemErr } = await admin.from('plaid_items').upsert(
      {
        user_id: user.id,
        access_token: accessToken,
        item_id: itemId,
        institution_name: summary.institutionName,
        environment: env,
      },
      { onConflict: 'user_id' },
    )
    if (itemErr) throw itemErr

    const verification = await storeVerification(admin, user.id, summary, env)
    return res.json(verification)
  } catch (err) {
    const msg = (err as { response?: { data?: { error_message?: string } } })?.response?.data?.error_message
    console.error('Plaid exchange error:', msg || (err as Error)?.message)
    return res.status(502).json({ error: msg || 'Could not verify your bank' })
  }
})

app.get('/api/plaid/verification', async (req, res) => {
  const user = await bearerUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })

  const { data, error } = await admin
    .from('plaid_financial_verifications')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()
  if (error) {
    console.error('Plaid verification read error:', error.message)
    return res.status(500).json({ error: 'Could not load verification status' })
  }
  return res.json({ verification: data ? verificationRow(data) : null })
})

app.post('/api/plaid/refresh', async (req, res) => {
  const user = await bearerUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const client = getPlaidClient()
  if (!client) return plaidUnavailable(res)
  const admin = getSupabaseAdmin()
  if (!admin) return res.status(500).json({ error: 'Server configuration error' })

  const { data: item, error: itemErr } = await admin
    .from('plaid_items')
    .select('access_token')
    .eq('user_id', user.id)
    .maybeSingle()
  if (itemErr) return res.status(500).json({ error: 'Could not load linked bank' })
  if (!item?.access_token) return res.status(404).json({ error: 'No linked bank to refresh' })

  try {
    const summary = await fetchFinancialSummary(client, item.access_token as string)
    const verification = await storeVerification(admin, user.id, summary, getPlaidEnv())
    return res.json(verification)
  } catch (err) {
    const msg = (err as { response?: { data?: { error_message?: string } } })?.response?.data?.error_message
    console.error('Plaid refresh error:', msg || (err as Error)?.message)
    return res.status(502).json({ error: msg || 'Could not refresh verification' })
  }
})

async function storeVerification(
  admin: SupabaseClient,
  userId: string,
  summary: Awaited<ReturnType<typeof fetchFinancialSummary>>,
  env: string,
) {
  // Data minimization: persist ONLY verification signals + the computed DTI.
  // Raw figures (income / balance / debt amounts), per-account breakdowns, the
  // account-holder name, and any contact PII are intentionally NOT stored --
  // the columns that used to hold them have been dropped from the table (see
  // migration 20260609120000_plaid_minimize_signals_only.sql).
  const payload = {
    user_id: userId,
    institution_name: summary.institutionName,
    accounts_count: summary.accountsCount,

    income_verified: summary.incomeVerified,
    balances_verified: summary.balancesVerified,
    debts_verified: summary.debtsVerified,
    dti_ratio: summary.dtiRatio,
    identity_verified: summary.identityVerified,

    environment: env,
    last_verified_at: new Date().toISOString(),
  }
  const { data, error } = await admin
    .from('plaid_financial_verifications')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()
  if (error) throw error
  return verificationRow(data)
}

// In production, serve the built client static assets and SPA fallback
if (process.env.NODE_ENV === 'production') {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  const candidates = [
    path.resolve(__dirname, '../client/dist'),
    path.resolve(__dirname, './client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
  ]
  const clientDist = candidates.find((p) => fs.existsSync(p))
  if (clientDist) {
    // Host-based routing for branded subdomains:
    //   value.gorentalcity.com -> the static Rental Value Report
    //   admin.gorentalcity.com -> the System Admin (client-side route)
    // Everything else (app.gorentalcity.com, *.replit.app) is unaffected.
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return next()
      // Replit's proxy may carry the requested host in either Host or
      // X-Forwarded-Host (and the latter can be a comma-separated chain), so
      // check every candidate rather than trusting a single header.
      const hosts = [req.headers['x-forwarded-host'], req.headers.host]
        .filter(Boolean)
        .flatMap((h) => String(h).split(','))
        .map((h) => h.trim().split(':')[0].toLowerCase())
      if (hosts.some((h) => h.startsWith('value.'))) {
        // Serve the report at the subdomain root, keeping the clean URL.
        if (req.path === '/') req.url = '/rental-value-report/index.html'
        return next()
      }
      if (hosts.some((h) => h.startsWith('admin.'))) {
        // The admin UI is a client-side route, so send the browser there.
        if (req.path === '/') return res.redirect(302, '/admin')
        return next()
      }
      next()
    })
    app.use(express.static(clientDist))
    app.get(/^\/(?!api\/).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'))
    })
    console.log(`Serving client static assets from ${clientDist}`)
  } else {
    console.warn('No client/dist directory found; static assets not served')
  }
}

app.listen(PORT, () => {
  console.log(`Rental City API running on http://localhost:${PORT}`)
})
