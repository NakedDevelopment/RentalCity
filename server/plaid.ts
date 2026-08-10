import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
} from 'plaid'

export function getPlaidEnv(): string {
  return (process.env.PLAID_ENV || 'sandbox').toLowerCase()
}

/** Returns a configured Plaid client, or null if credentials are missing. */
export function getPlaidClient(): PlaidApi | null {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  if (!clientId || !secret) return null

  const env = getPlaidEnv()
  const basePath = PlaidEnvironments[env] ?? PlaidEnvironments.sandbox

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

export async function createLinkToken(client: PlaidApi, userId: string): Promise<string> {
  const resp = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Rental City',
    // transactions -> income streams; identity -> name match; liabilities -> debts/DTI
    // assets + income_verification added for richer Income/Assets product access
    products: [
      Products.Transactions,
      Products.Identity,
      Products.Liabilities,
      Products.Assets,
      Products.IncomeVerification,
    ],
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

export type DebtInfo = {
  name: string
  kind: 'credit' | 'student' | 'mortgage'
  balanceCents: number | null
  monthlyPaymentCents: number | null
  aprPercent: number | null
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

  // Debts / DTI
  debtsVerified: boolean
  totalMonthlyDebtCents: number
  debts: DebtInfo[]
  dtiRatio: number | null

  // Identity (bank account name match — separate from Plaid IDV)
  identityVerified: boolean
}

// Plaid recurring-stream frequency -> approximate number of occurrences per month.
const FREQUENCY_TO_MONTHLY: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
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

/**
 * Pulls a full financial picture for a linked item: income (recurring deposit
 * streams), balances + reserves (proof of funds), debts -> debt-to-income, and
 * the identity on the account. Each product call is wrapped defensively so a
 * not-ready / unsupported product degrades gracefully instead of failing the
 * whole request.
 */
export async function fetchFinancialSummary(
  client: PlaidApi,
  accessToken: string,
): Promise<PlaidFinancialSummary> {
  // --- Balances + accounts (proof of funds) ---
  let accountsCount = 0
  let available = 0
  let current = 0
  let totalAssets = 0
  let balancesVerified = false
  const accounts: AccountInfo[] = []
  const accountNameById = new Map<string, string>()
  const accountBalanceById = new Map<string, number | null>()

  try {
    const balResp = await client.accountsBalanceGet({ access_token: accessToken })
    const apiAccounts = balResp.data.accounts ?? []
    accountsCount = apiAccounts.length
    for (const a of apiAccounts) {
      const label = a.official_name || a.name || a.subtype || 'Account'
      accountNameById.set(a.account_id, `${label}${a.mask ? ` ••${a.mask}` : ''}`)
      accountBalanceById.set(a.account_id, toCentsOrNull(a.balances?.current))
      const isDepository = a.type === 'depository'
      accounts.push({
        name: label,
        mask: a.mask ?? null,
        subtype: a.subtype ?? null,
        availableCents: toCentsOrNull(a.balances?.available),
        currentCents: toCentsOrNull(a.balances?.current),
      })
      if (isDepository) {
        const avail = typeof a.balances?.available === 'number' ? a.balances.available : null
        const curr = typeof a.balances?.current === 'number' ? a.balances.current : null
        if (avail !== null) available += avail
        if (curr !== null) current += curr
        totalAssets += avail ?? curr ?? 0
      }
    }
    balancesVerified = accountsCount > 0
  } catch {
    // leave balances unverified
  }

  // --- Institution name ---
  let institutionName: string | null = null
  try {
    const itemResp = await client.itemGet({ access_token: accessToken })
    const institutionId = itemResp.data.item?.institution_id
    if (institutionId) {
      const instResp = await client.institutionsGetById({
        institution_id: institutionId,
        country_codes: [CountryCode.Us],
      })
      institutionName = instResp.data.institution?.name ?? null
    }
  } catch {
    // institution name is best-effort
  }

  // --- Income: recurring inflow streams ---
  let monthlyIncome = 0
  const incomeStreams: IncomeStream[] = []
  try {
    const recResp = await client.transactionsRecurringGet({ access_token: accessToken })
    const inflows = recResp.data.inflow_streams ?? []
    for (const stream of inflows) {
      const freq = String(stream.frequency ?? '').toUpperCase()
      const mult = FREQUENCY_TO_MONTHLY[freq]
      if (!mult) continue
      const amt = Math.abs(Number(stream.average_amount?.amount ?? 0))
      if (!Number.isFinite(amt) || amt <= 0) continue
      const monthlyAmountCents = Math.round(amt * mult * 100)
      monthlyIncome += amt * mult
      incomeStreams.push({
        name: stream.merchant_name || stream.description || 'Recurring deposit',
        monthlyAmountCents,
        frequency: freq,
        monthsSeen: monthsBetween(stream.first_date, stream.last_date),
      })
    }
  } catch {
    // recurring not ready; fall back below
  }

  if (monthlyIncome <= 0) {
    try {
      const end = new Date()
      const start = new Date()
      start.setDate(start.getDate() - 30)
      const fmt = (d: Date) => d.toISOString().slice(0, 10)
      const txResp = await client.transactionsGet({
        access_token: accessToken,
        start_date: fmt(start),
        end_date: fmt(end),
        options: { count: 250, offset: 0 },
      })
      let inflow = 0
      for (const t of txResp.data.transactions ?? []) {
        // Plaid convention: negative amount = money into the account (deposit).
        if (typeof t.amount === 'number' && t.amount < 0) inflow += Math.abs(t.amount)
      }
      monthlyIncome = inflow
    } catch {
      // transactions not ready; income stays 0 / unverified
    }
  }

  incomeStreams.sort((a, b) => b.monthlyAmountCents - a.monthlyAmountCents)
  const monthlyIncomeCents = Math.round(monthlyIncome * 100)

  // Build a ±15 % income range for display purposes. Only set when income was
  // actually detected; null when we have nothing to show.
  const monthlyIncomeRangeLowCents = monthlyIncomeCents > 0
    ? Math.round(monthlyIncomeCents * 0.85)
    : null
  const monthlyIncomeRangeHighCents = monthlyIncomeCents > 0
    ? Math.round(monthlyIncomeCents * 1.15)
    : null

  // --- Debts: liabilities -> monthly obligations + DTI ---
  let debtsVerified = false
  let totalMonthlyDebt = 0
  const debts: DebtInfo[] = []
  try {
    const liabResp = await client.liabilitiesGet({ access_token: accessToken })
    // Merge any account names / balances we didn't already have.
    for (const a of liabResp.data.accounts ?? []) {
      if (!accountNameById.has(a.account_id)) {
        const label = a.official_name || a.name || a.subtype || 'Account'
        accountNameById.set(a.account_id, `${label}${a.mask ? ` ••${a.mask}` : ''}`)
      }
      if (!accountBalanceById.has(a.account_id)) {
        accountBalanceById.set(a.account_id, toCentsOrNull(a.balances?.current))
      }
    }
    const liabilities = liabResp.data.liabilities
    debtsVerified = true

    const debtBalance = (id: string | null) =>
      (id != null ? accountBalanceById.get(id) ?? null : null)

    for (const c of liabilities?.credit ?? []) {
      const monthly = toCentsOrNull(c.minimum_payment_amount)
      const apr = c.aprs?.find((x) => x.apr_type === 'purchase_apr')?.apr_percentage
        ?? c.aprs?.[0]?.apr_percentage
        ?? null
      debts.push({
        name: (c.account_id && accountNameById.get(c.account_id)) || 'Credit card',
        kind: 'credit',
        balanceCents: debtBalance(c.account_id) ?? toCentsOrNull(c.last_statement_balance),
        monthlyPaymentCents: monthly,
        aprPercent: typeof apr === 'number' ? apr : null,
      })
      if (monthly) totalMonthlyDebt += monthly
    }

    for (const s of liabilities?.student ?? []) {
      const monthly = toCentsOrNull(s.minimum_payment_amount)
      debts.push({
        name: (s.account_id && accountNameById.get(s.account_id)) || 'Student loan',
        kind: 'student',
        balanceCents: debtBalance(s.account_id ?? null),
        monthlyPaymentCents: monthly,
        aprPercent: typeof s.interest_rate_percentage === 'number' ? s.interest_rate_percentage : null,
      })
      if (monthly) totalMonthlyDebt += monthly
    }

    for (const m of liabilities?.mortgage ?? []) {
      const monthly = toCentsOrNull(m.next_monthly_payment)
      debts.push({
        name: (m.account_id && accountNameById.get(m.account_id)) || 'Mortgage',
        kind: 'mortgage',
        balanceCents: debtBalance(m.account_id ?? null),
        monthlyPaymentCents: monthly,
        aprPercent: typeof m.interest_rate?.percentage === 'number' ? m.interest_rate.percentage : null,
      })
      if (monthly) totalMonthlyDebt += monthly
    }
  } catch {
    // liabilities not available for this institution
  }

  const totalMonthlyDebtCents = Math.round(totalMonthlyDebt)
  // DTI is only meaningful with reliably captured income. A ratio above ~500%
  // means income wasn't detected properly (e.g. only stray interest deposits),
  // so we null it rather than surface an absurd percentage.
  const rawDti =
    monthlyIncomeCents > 0 ? Math.round((totalMonthlyDebtCents / monthlyIncomeCents) * 10000) / 10000 : null
  const dtiRatio = rawDti !== null && rawDti <= 5 ? rawDti : null

  // --- Identity on the account ---
  // We only retain whether the account holder's identity could be verified
  // (a name is present on the account). No contact PII (email / phone /
  // address) and not even the name itself is collected, stored, or returned.
  let identityVerified = false
  try {
    const idResp = await client.identityGet({ access_token: accessToken })
    const owners = (idResp.data.accounts ?? []).flatMap((a) => a.owners ?? [])
    identityVerified = owners.some((o) => (o.names ?? []).some((n) => !!n))
  } catch {
    // identity not available for this institution
  }

  const totalAssetsCentsVal = toCents(totalAssets)
  const assetTier = balancesVerified
    ? computeAssetTier(totalAssetsCentsVal, monthlyIncomeCents)
    : null

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
    debts,
    dtiRatio,

    identityVerified,
  }
}
