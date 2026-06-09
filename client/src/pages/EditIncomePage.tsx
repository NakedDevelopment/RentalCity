import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { usePlaidLink } from 'react-plaid-link'
import { scoreTenantDimensions } from '../lib/tenantScoring'
import type { TenantQuestionId, TenantChoiceId } from '../lib/tenantQuestionnaire'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'
import {
  createPlaidLinkToken,
  exchangePlaidPublicToken,
  getPlaidVerification,
  refreshPlaidVerification,
  type PlaidVerification,
} from '../lib/plaidApi'

const RENTAL_BUDGET_TO_RENT: Record<string, number> = {
  a: 1200,
  b: 1325,
  c: 1575,
  d: 1850,
  e: 2250,
  f: 2750,
}

function formatMoney(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

function CheckIcon({ className = 'h-3.5 w-3.5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ScoreRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <dt className="text-sm text-gray-700">{label}</dt>
      <dd>
        {ok ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
            <CheckIcon /> Verified
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not verified</span>
        )}
      </dd>
    </div>
  )
}

export function EditIncomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [existingAnswers, setExistingAnswers] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [verification, setVerification] = useState<PlaidVerification | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidLoading, setPlaidLoading] = useState(false)
  const [plaidError, setPlaidError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('tenant_questionnaire')
      .select('answers')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.answers && typeof data.answers === 'object') {
          const raw = data.answers as Record<string, unknown>
          setExistingAnswers(raw)
          const savedIncome = raw.monthly_income
          if (typeof savedIncome === 'number' && Number.isFinite(savedIncome)) setMonthlyIncome(String(savedIncome))
          else if (typeof savedIncome === 'string' && savedIncome.trim()) setMonthlyIncome(savedIncome.trim())
        } else {
          setExistingAnswers({})
        }
      })
  }, [user])

  useEffect(() => {
    if (!user) return
    getAccessToken().then((token) => {
      if (!token) return
      getPlaidVerification(token)
        .then(setVerification)
        .catch(() => {})
    })
  }, [user])

  const incomeNum = useMemo(() => {
    const v = monthlyIncome.trim()
    if (!v) return 0
    const parsed = parseFloat(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }, [monthlyIncome])

  const onPlaidSuccess = useCallback(async (publicToken: string) => {
    setPlaidLoading(true)
    setPlaidError(null)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const v = await exchangePlaidPublicToken(token, publicToken)
      setVerification(v)
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : 'Could not verify your bank')
    } finally {
      setPlaidLoading(false)
      setLinkToken(null)
    }
  }, [])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken) => {
      void onPlaidSuccess(publicToken)
    },
    onExit: () => {
      setLinkToken(null)
      setPlaidLoading(false)
    },
  })

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function handleConnectBank() {
    setPlaidError(null)
    setPlaidLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const lt = await createPlaidLinkToken(token)
      setLinkToken(lt)
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : 'Could not start bank connection')
      setPlaidLoading(false)
    }
  }

  async function handleRefresh() {
    setPlaidError(null)
    setPlaidLoading(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      const v = await refreshPlaidVerification(token)
      setVerification(v)
    } catch (err) {
      setPlaidError(err instanceof Error ? err.message : 'Could not refresh verification')
    } finally {
      setPlaidLoading(false)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)

    if (incomeNum <= 0) {
      setError('Enter a monthly income greater than 0.')
      setLoading(false)
      return
    }

    const merged = { ...(existingAnswers || {}), monthly_income: incomeNum } as Record<string, unknown>
    const rentChoice = merged.rental_budget as string | undefined
    const rent = rentChoice && rentChoice in RENTAL_BUDGET_TO_RENT ? RENTAL_BUDGET_TO_RENT[rentChoice] : 0
    const dims = scoreTenantDimensions(
      merged as Record<TenantQuestionId, TenantChoiceId | null | undefined>,
      rent,
      incomeNum,
    )

    const { error: saveError } = await supabase
      .from('tenant_questionnaire')
      .upsert(
        {
          user_id: user.id,
          answers: merged,
          stability_score: dims.stability,
          payment_risk_score: dims.paymentRisk,
          affordability_score: dims.affordability,
          lifestyle_score: dims.lifestyle,
          space_fit_score: dims.spaceFit,
          overall_score: dims.overall,
        },
        { onConflict: 'user_id' },
      )

    setLoading(false)
    if (saveError) {
      setError('Could not save. Please try again.')
      return
    }

    navigate('/account')
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  const v = verification
  const hasAnyVerification = Boolean(
    v && (v.incomeVerified || v.balancesVerified || v.debtsVerified || v.identityVerified),
  )
  const dtiPct = typeof v?.dtiRatio === 'number' ? Math.round(v.dtiRatio * 100) : null

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link
        to="/account"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to profile
      </Link>
      <h1 className="text-[1.5rem] font-medium text-gray-900">Edit income</h1>
      <p className="mt-1 text-sm text-gray-600">
        Update your monthly income to improve affordability matching.
      </p>

      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Verify with your bank</h2>
            <p className="mt-1 text-xs text-gray-500">
              Securely connect your bank through Plaid. We only keep the verification result — never your
              account numbers, balances, or transactions.
            </p>
          </div>
          {hasAnyVerification ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
              <CheckIcon />
              Verified
            </span>
          ) : null}
        </div>

        {v && hasAnyVerification ? (
          <div className="mt-4 space-y-4">
            {v.institutionName ? (
              <p className="text-xs text-gray-500">
                Connected to {v.institutionName}
                {v.accountsCount ? ` · ${v.accountsCount} account${v.accountsCount === 1 ? '' : 's'}` : ''}
              </p>
            ) : null}

            {/* Verification scorecard — signals only, no raw figures */}
            <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100">
              <ScoreRow label="Income" ok={v.incomeVerified} />
              <ScoreRow label="Identity" ok={v.identityVerified} />
              <ScoreRow label="Funds available" ok={v.balancesVerified} />
              <div className="flex items-center justify-between px-3 py-2.5">
                <dt className="text-sm text-gray-700">Debt-to-income</dt>
                <dd>
                  {dtiPct !== null ? (
                    <span
                      className={`text-sm font-semibold ${
                        dtiPct <= 36 ? 'text-green-700' : dtiPct <= 43 ? 'text-amber-600' : 'text-red-600'
                      }`}
                    >
                      {dtiPct}%
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">Not available</span>
                  )}
                </dd>
              </div>
            </dl>

            {v.debtsVerified && dtiPct === null ? (
              <p className="text-xs text-gray-500">
                Debt-to-income isn’t shown because we couldn’t reliably detect recurring income from this
                account.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRefresh}
                disabled={plaidLoading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {plaidLoading ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={handleConnectBank}
                disabled={plaidLoading}
                className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Reconnect a different bank
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <button
              type="button"
              onClick={handleConnectBank}
              disabled={plaidLoading}
              className="rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
            >
              {plaidLoading ? 'Connecting...' : 'Connect bank to verify'}
            </button>
          </div>
        )}

        {plaidError ? <p className="mt-3 text-xs text-red-600">{plaidError}</p> : null}
      </div>

      <form onSubmit={handleSave} className="mt-6 space-y-5">
        <div>
          <label htmlFor="monthly-income" className="mb-2 block text-sm font-medium text-gray-800">
            Monthly income
          </label>
          <input
            id="monthly-income"
            inputMode="decimal"
            value={monthlyIncome}
            onChange={(e) => setMonthlyIncome(e.target.value)}
            placeholder="$6,000"
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400"
          />
          {v?.incomeVerified ? (
            <p className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-green-700">
              <CheckIcon />
              Income verified with your bank via Plaid.
            </p>
          ) : incomeNum > 0 ? (
            <p className="mt-2 text-xs text-gray-500">We’ll use {formatMoney(incomeNum)} / month for affordability.</p>
          ) : (
            <p className="mt-2 text-xs text-gray-500">Enter your gross monthly income before taxes.</p>
          )}
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <Link
            to="/account"
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
