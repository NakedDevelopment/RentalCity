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
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return resp.data.link_token
}

export async function exchangePublicToken(
  client: PlaidApi,
  publicToken: string,
): Promise<{ accessToken: string; itemId: string }> {
  const resp = await client.itemPublicTokenExchange({ public_token: publicToken })
  return { accessToken: resp.data.access_token, itemId: resp.data.item_id }
}

export type PlaidFinancialSummary = {
  institutionName: string | null
  accountsCount: number
  incomeVerified: boolean
  monthlyIncomeCents: number
  balancesVerified: boolean
  availableBalanceCents: number
  currentBalanceCents: number
}

// Plaid recurring-stream frequency -> approximate number of occurrences per month.
const FREQUENCY_TO_MONTHLY: Record<string, number> = {
  WEEKLY: 52 / 12,
  BIWEEKLY: 26 / 12,
  SEMI_MONTHLY: 2,
  MONTHLY: 1,
  ANNUALLY: 1 / 12,
}

/**
 * Pulls a summary of balances and estimated monthly income for a linked item.
 * Income is derived from recurring deposit (inflow) streams; if those are not
 * ready yet, it falls back to summing inflow transactions over the last 30 days.
 * Bank-data calls are wrapped defensively so a not-ready product degrades to
 * "unverified" rather than failing the whole request.
 */
export async function fetchFinancialSummary(
  client: PlaidApi,
  accessToken: string,
): Promise<PlaidFinancialSummary> {
  let accountsCount = 0
  let available = 0
  let current = 0
  let balancesVerified = false

  try {
    const balResp = await client.accountsBalanceGet({ access_token: accessToken })
    const accounts = balResp.data.accounts ?? []
    accountsCount = accounts.length
    const depository = accounts.filter((a) => a.type === 'depository')
    const considered = depository.length ? depository : accounts
    for (const a of considered) {
      if (typeof a.balances?.available === 'number') available += a.balances.available
      if (typeof a.balances?.current === 'number') current += a.balances.current
    }
    balancesVerified = accountsCount > 0
  } catch {
    // leave balances unverified
  }

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

  let monthlyIncome = 0
  try {
    const recResp = await client.transactionsRecurringGet({ access_token: accessToken })
    const inflows = recResp.data.inflow_streams ?? []
    for (const stream of inflows) {
      const freq = String(stream.frequency ?? '').toUpperCase()
      const mult = FREQUENCY_TO_MONTHLY[freq]
      if (!mult) continue
      const amt = Math.abs(Number(stream.average_amount?.amount ?? 0))
      if (Number.isFinite(amt)) monthlyIncome += amt * mult
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

  const monthlyIncomeCents = Math.round(monthlyIncome * 100)

  return {
    institutionName,
    accountsCount,
    incomeVerified: monthlyIncomeCents > 0,
    monthlyIncomeCents,
    balancesVerified,
    availableBalanceCents: Math.round(available * 100),
    currentBalanceCents: Math.round(current * 100),
  }
}
