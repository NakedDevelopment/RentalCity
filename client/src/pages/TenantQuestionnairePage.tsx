import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { scoreTenantDimensions } from '../lib/tenantScoring'
import { tenantQuestions } from '../lib/tenantQuestionnaire'
import type { TenantQuestionId, TenantChoiceId } from '../lib/tenantQuestionnaire'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const RENTAL_BUDGET_TO_RENT: Record<TenantChoiceId, number> = {
  a: 1200,
  b: 1325,
  c: 1575,
  d: 1850,
  e: 2250,
  f: 2750,
}

export function TenantQuestionnairePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<Record<TenantQuestionId, TenantChoiceId | null | undefined>>({} as Record<TenantQuestionId, TenantChoiceId | null | undefined>)
  const [monthlyIncome, setMonthlyIncome] = useState('')
  const [completeError, setCompleteError] = useState<string | null>(null)

  const [bio, setBio] = useState('')

  useEffect(() => {
    if (!user) return
    Promise.all([
      supabase.from('profiles').select('bio').eq('id', user.id).maybeSingle(),
      supabase.from('tenant_questionnaire').select('answers').eq('user_id', user.id).maybeSingle(),
    ]).then(([{ data: profileData }, { data: questionnaireData }]) => {
      if (profileData?.bio?.trim()) setBio(profileData.bio.trim())
      if (questionnaireData?.answers && typeof questionnaireData.answers === 'object') {
        const raw = questionnaireData.answers as Record<string, unknown>
        setAnswers((prev) => ({ ...prev, ...raw } as Record<TenantQuestionId, TenantChoiceId | null | undefined>))
        const savedIncome = raw.monthly_income
        if (savedIncome != null && typeof savedIncome === 'number') setMonthlyIncome(String(savedIncome))
        else if (typeof savedIncome === 'string' && savedIncome.trim()) setMonthlyIncome(savedIncome.trim())
      }
    })
  }, [user])

  const totalSteps = tenantQuestions.length + 2 // bio + questions + income
  const isBioStep = step === 1
  const isIncomeStep = step === totalSteps
  const currentQuestion = !isBioStep && !isIncomeStep ? tenantQuestions[step - 2] : null
  const selectedAnswer = currentQuestion ? answers[currentQuestion.id] : undefined
  const progressPercent = totalSteps > 0 ? Math.round((step / totalSteps) * 10) * 10 : 0
  const incomeNum = monthlyIncome.trim() ? parseFloat(monthlyIncome.replace(/[^0-9.]/g, '')) : 0
  const rentChoice = answers['rental_budget']
  const rent = rentChoice && rentChoice in RENTAL_BUDGET_TO_RENT ? RENTAL_BUDGET_TO_RENT[rentChoice] : 0
  const canProceed = isBioStep ? true : isIncomeStep ? incomeNum > 0 : !!selectedAnswer

  function handleSelect(choiceId: TenantChoiceId) {
    if (!currentQuestion) return
    setAnswers((prev) => ({ ...prev, [currentQuestion.id]: choiceId }))
  }

  async function handleBioNext() {
    if (!user) return
    await supabase
      .from('profiles')
      .update({ bio: bio.trim() || null })
      .eq('id', user.id)
    setStep((s) => s + 1)
  }

  async function handleComplete() {
    setCompleteError(null)
    if (!user || incomeNum <= 0) return
    const dims = scoreTenantDimensions(answers, rent, incomeNum)
    const answersWithIncome = { ...answers, monthly_income: incomeNum } as Record<string, unknown>
    const { error } = await supabase
      .from('tenant_questionnaire')
      .upsert(
        {
          user_id: user.id,
          answers: answersWithIncome,
          stability_score: dims.stability,
          payment_risk_score: dims.paymentRisk,
          affordability_score: dims.affordability,
          lifestyle_score: dims.lifestyle,
          space_fit_score: dims.spaceFit,
          overall_score: dims.overall,
        },
        { onConflict: 'user_id' }
      )
    if (error) {
      setCompleteError('Could not save. Please try again.')
      return
    }

    // Mark survey as completed so matches unlock and UI can gate correctly.
    await supabase
      .from('profiles')
      .update({ tenant_survey_completed_at: new Date().toISOString() })
      .eq('id', user.id)

    navigate('/matches')
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-[502px] rounded-2xl border border-gray-200 bg-white px-5 py-7 shadow-sm">
        <div className="text-center">
          <h1 className="text-[2rem] font-medium text-gray-900">Tenant Questionnaire</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Help us match you with compatible landlords.
          </p>
        </div>

        <div className="mt-7">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
            <span>
              Step {step} of {totalSteps}
            </span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-gray-900 transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {isBioStep ? (
          <div className="mt-7">
            <h2 className="text-[1.35rem] font-medium text-gray-900">About Me</h2>
            <p className="mt-2 text-sm text-gray-600">
              Introduce yourself to landlords. Share your lifestyle, work, and what kind of tenant you are. This helps you stand out in applications.
            </p>
            <textarea
              rows={5}
              placeholder="e.g. I'm a remote software engineer who works from home. I enjoy quiet evenings and keep a tidy space. I've been renting for 5+ years and always pay on time."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="mt-4 w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>
        ) : isIncomeStep ? (
          <div className="mt-7">
            <h2 className="text-[1.35rem] font-medium text-gray-900">What is your gross monthly income?</h2>
            <p className="mt-2 text-sm text-gray-600">
              Used to calculate affordability. Your income is never shared with landlords.
            </p>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 5000"
              value={monthlyIncome}
              onChange={(e) => setMonthlyIncome(e.target.value)}
              className="mt-4 w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>
        ) : currentQuestion ? (
          <>
            <div className="mt-7">
              <h2 className="text-[1.35rem] font-medium text-gray-900">{currentQuestion.text}</h2>
              {currentQuestion.helperText && (
                <p className="mt-2 text-sm text-gray-600">{currentQuestion.helperText}</p>
              )}
            </div>

            <div className="mt-6 space-y-3">
              {currentQuestion.choices.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleSelect(choice.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-5 text-left transition-colors ${
                    selectedAnswer === choice.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      selectedAnswer === choice.id ? 'border-gray-900 bg-gray-900' : 'border-gray-400 bg-white'
                    }`}
                  >
                    {selectedAnswer === choice.id ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                  </span>
                  <span className="text-base text-gray-800">{choice.label}</span>
                </button>
              ))}
            </div>
          </>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate(-1))}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>

          <Link to="/matches" className="text-sm font-medium text-gray-600 hover:text-gray-900">
            Skip for now
          </Link>

          {step < totalSteps ? (
            <button
              type="button"
              onClick={() => (isBioStep ? handleBioNext() : canProceed && setStep((s) => s + 1))}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Next
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleComplete}
              disabled={!canProceed}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              Complete
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>

        {completeError && (
          <p className="mt-4 text-center text-sm text-red-600">{completeError}</p>
        )}
      </div>
    </div>
  )
}
