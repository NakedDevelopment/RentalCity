import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { scoreTenantDimensions } from '../lib/tenantScoring'
import { tenantQuestions } from '../lib/tenantQuestionnaire'
import type { TenantQuestionId, TenantChoiceId } from '../lib/tenantQuestionnaire'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const RENTAL_HISTORY_IDS: TenantQuestionId[] = [
  'previous_landlord_duration',
  'late_fees_last_two_years',
  'late_frequency_reported',
  'eviction_history',
]

const RENTAL_BUDGET_TO_RENT: Record<string, number> = {
  a: 1200,
  b: 1325,
  c: 1575,
  d: 1850,
  e: 2250,
  f: 2750,
}

const rentalHistoryQuestions = tenantQuestions.filter((q) => RENTAL_HISTORY_IDS.includes(q.id))

export function EditRentalHistoryPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [answers, setAnswers] = useState<Record<TenantQuestionId, TenantChoiceId | null | undefined>>({} as Record<TenantQuestionId, TenantChoiceId | null | undefined>)
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
          setAnswers((prev) => ({ ...prev, ...raw } as Record<TenantQuestionId, TenantChoiceId | null | undefined>))
        }
      })
  }, [user])

  function handleSelect(questionId: TenantQuestionId, choiceId: TenantChoiceId) {
    setAnswers((prev) => ({ ...prev, [questionId]: choiceId }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)
    const merged = { ...(existingAnswers || {}), ...answers } as Record<string, unknown>
    const rentChoice = merged.rental_budget as string | undefined
    const rent = rentChoice && rentChoice in RENTAL_BUDGET_TO_RENT ? RENTAL_BUDGET_TO_RENT[rentChoice] : 0
    const monthlyIncome = typeof merged.monthly_income === 'number' ? merged.monthly_income : 0
    const dims = scoreTenantDimensions(
      merged as Record<TenantQuestionId, TenantChoiceId | null | undefined>,
      rent,
      monthlyIncome || 1,
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
      <h1 className="text-[1.5rem] font-medium text-gray-900">Edit rental history</h1>
      <p className="mt-1 text-sm text-gray-600">
        Update your rental history details. Landlords use this to assess reliability.
      </p>
      <form onSubmit={handleSave} className="mt-6 space-y-6">
        {rentalHistoryQuestions.map((q) => (
          <div key={q.id}>
            <h2 className="text-base font-medium text-gray-900">{q.text}</h2>
            {q.helperText && <p className="mt-1 text-sm text-gray-600">{q.helperText}</p>}
            <div className="mt-3 space-y-2">
              {q.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleSelect(q.id, choice.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                    answers[q.id] === choice.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      answers[q.id] === choice.id ? 'border-gray-900 bg-gray-900' : 'border-gray-400 bg-white'
                    }`}
                  >
                    {answers[q.id] === choice.id ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                  <span className="text-sm text-gray-800">{choice.label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
        {error && <p className="text-sm text-red-600">{error}</p>}
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
