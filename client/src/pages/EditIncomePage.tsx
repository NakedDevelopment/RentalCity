import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { scoreTenantDimensions } from '../lib/tenantScoring'
import type { TenantQuestionId, TenantChoiceId } from '../lib/tenantQuestionnaire'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

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

export function EditIncomePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [existingAnswers, setExistingAnswers] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  const incomeNum = useMemo(() => {
    const v = monthlyIncome.trim()
    if (!v) return 0
    const parsed = parseFloat(v.replace(/[^0-9.]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }, [monthlyIncome])

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
          {incomeNum > 0 ? (
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

