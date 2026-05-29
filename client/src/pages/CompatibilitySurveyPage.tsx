import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { deriveLandlordPreferences } from '../lib/landlordPreferences'
import { landlordQuestions } from '../lib/landlordQuestionnaire'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'

type SurveyQuestion = {
  question: string
  prompt: string
  options: string[]
}

const TENANT_SURVEY_QUESTIONS: SurveyQuestion[] = [
  {
    question: 'Question 1',
    prompt: 'How long were you at your previous landlord?',
    options: ['1 year or less', '1 - 2 years', '2 - 4 years', '4 years or more'],
  },
  {
    question: 'Question 2',
    prompt: 'Do you have pets?',
    options: ['No pets', 'One small pet', 'Multiple pets', 'Service/emotional support animal'],
  },
  {
    question: 'Question 3',
    prompt: 'What is your ideal lease length?',
    options: ['Month-to-month', '6 months', '1 year', '2+ years'],
  },
  {
    question: 'Question 4',
    prompt: 'How often do you prefer landlord communication?',
    options: ['Only when necessary', 'Monthly check-ins', 'Quarterly updates', 'Open anytime'],
  },
  {
    question: 'Question 5',
    prompt: 'What is your approach to property maintenance?',
    options: ['Report and wait', 'Report and follow up', 'Can handle minor fixes myself', 'Prefer DIY when possible'],
  },
  {
    question: 'Question 6',
    prompt: 'How important is having guests or roommates?',
    options: ['Very important', 'Somewhat important', 'Occasionally', 'Prefer living alone'],
  },
  {
    question: 'Question 7',
    prompt: 'What is your typical noise level preference?',
    options: ['Quiet/peaceful', 'Moderate', 'Social/active', 'Flexible'],
  },
  {
    question: 'Question 8',
    prompt: 'Are you a smoker?',
    options: ['Non-smoker', 'Smoker (outdoor only)', 'Smoker (indoor)', 'Prefer not to say'],
  },
  {
    question: 'Question 9',
    prompt: 'How do you prefer to handle rent payments?',
    options: ['Online/autopay', 'Bank transfer', 'Check', 'Flexible'],
  },
  {
    question: 'Question 10',
    prompt: 'What matters most in a landlord relationship?',
    options: ['Responsiveness', 'Privacy', 'Clear rules', 'Flexibility'],
  },
  {
    question: 'Question 11',
    prompt: 'How do you prefer maintenance requests?',
    options: ['Online portal', 'Text/email', 'Phone call', 'In person'],
  },
  {
    question: 'Question 12',
    prompt: 'What is your employment situation?',
    options: ['Employed full-time', 'Employed part-time', 'Self-employed', 'Student'],
  },
  {
    question: 'Question 13',
    prompt: 'What best describes your lifestyle?',
    options: ['Homebody', 'Balanced', 'Active/social', 'Frequently traveling'],
  },
]

export function CompatibilitySurveyPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { role: profileRole, landlordSurveyCompletedAt, loading: roleLoading } = useProfileRole(user)
  const [searchParams] = useSearchParams()
  const isEditMode = searchParams.get('mode') === 'edit'
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({})
  const [completeError, setCompleteError] = useState<string | null>(null)

  useEffect(() => {
    if (roleLoading || profileRole === null) return
    if (profileRole === 'landlord') {
      if (landlordSurveyCompletedAt && !isEditMode) {
        navigate('/onboarding/property/intro', { replace: true })
      }
      return
    }
    // Tenants no longer use this multi-step survey page; send them to lease preferences in shell.
    if (profileRole === 'tenant') {
      navigate('/lease-preferences', { replace: true })
    }
  }, [roleLoading, profileRole, landlordSurveyCompletedAt, navigate, isEditMode])

  useEffect(() => {
    if (!user || roleLoading || profileRole !== 'landlord') return
    supabase
      .from('landlord_questionnaire')
      .select('answers')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.answers && typeof data.answers === 'object') {
          setAnswers(data.answers as Record<string, string | string[]>)
        }
      })
  }, [user, roleLoading, profileRole])

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  const surveyQuestions = profileRole === 'landlord' ? landlordQuestions : TENANT_SURVEY_QUESTIONS
  const totalQuestions = surveyQuestions.length
  const currentQuestion = surveyQuestions[step - 1]
  const landlordQuestion = profileRole === 'landlord' ? (currentQuestion as (typeof landlordQuestions)[0]) : null
  const tenantQuestion = profileRole === 'tenant' ? (currentQuestion as SurveyQuestion) : null
  const selectedAnswer = landlordQuestion ? answers[landlordQuestion.id] : answers[step]
  const progressPercent = totalQuestions > 0 ? Math.round((step / totalQuestions) * 10) * 10 : 0
  const isMulti = landlordQuestion?.type === 'multi'

  function handleSelectTenant(option: string) {
    setAnswers((prev) => ({ ...prev, [String(step)]: option }))
  }

  function handleSelectLandlord(choiceId: string) {
    if (!landlordQuestion) return
    const qid = landlordQuestion.id
    if (landlordQuestion.type === 'single') {
      setAnswers((prev) => ({ ...prev, [qid]: choiceId }))
    } else {
      const exclusiveIds = new Set(
        landlordQuestion.choices.filter((c) => c.exclusive).map((c) => c.id)
      )
      const arr = Array.isArray(answers[qid]) ? (answers[qid] as string[]) : []
      let next: string[]
      if (arr.includes(choiceId)) {
        next = arr.filter((c) => c !== choiceId)
      } else if (exclusiveIds.has(choiceId)) {
        // Selecting an exclusive option clears every other choice.
        next = [choiceId]
      } else {
        // Selecting a normal option clears any exclusive choices.
        next = [...arr.filter((c) => !exclusiveIds.has(c)), choiceId]
      }
      setAnswers((prev) => ({ ...prev, [qid]: next }))
    }
  }

  const canProceed = profileRole === 'landlord'
    ? (currentQuestion
        ? isMulti
          ? Array.isArray(selectedAnswer) && selectedAnswer.length > 0
          : !!selectedAnswer && typeof selectedAnswer === 'string'
        : false)
    : !!selectedAnswer

  async function handleCompleteTenant() {
    navigate('/lease-preferences')
  }

  async function handleComplete() {
    setCompleteError(null)
    if (!user) return
    const prefs = deriveLandlordPreferences(answers as Record<string, string | string[] | null | undefined>)
    const { error: qErr } = await supabase
      .from('landlord_questionnaire')
      .upsert(
        {
          user_id: user.id,
          answers,
          policy_strictness_score: prefs.policyStrictnessScore,
          risk_tolerance_score: prefs.riskToleranceScore,
          conflict_style_score: prefs.conflictStyleScore,
        },
        { onConflict: 'user_id' }
      )
    if (qErr) {
      setCompleteError('Could not save answers. Please try again.')
      return
    }
    const { error } = await supabase
      .from('profiles')
      .update({ landlord_survey_completed_at: new Date().toISOString() })
      .eq('id', user.id)
    if (error) {
      setCompleteError('Could not save. Please try again.')
      return
    }
    navigate('/onboarding/property/intro')
  }

  if (profileRole === 'landlord' && landlordQuestion) {
    return (
      <div className="px-4 py-12">
        <div className="mx-auto max-w-[502px] rounded-2xl border border-gray-200 bg-white px-5 py-7 shadow-sm">
          <div className="text-center">
            <h1 className="text-[2rem] font-medium text-gray-900">Landlord Survey</h1>
            <p className="mt-3 text-sm leading-7 text-gray-600">
              This short survey helps us match you with compatible tenants.
            </p>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>
                Question {step} of {totalQuestions}
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

          <div className="mt-7">
            <h2 className="text-[1.35rem] font-medium text-gray-900">{landlordQuestion.text}</h2>
            {landlordQuestion.helperText && (
              <p className="mt-2 text-sm text-gray-600">{landlordQuestion.helperText}</p>
            )}
          </div>

          <div className="mt-6 space-y-3">
            {landlordQuestion.choices.map((choice) => {
              const selected = isMulti
                ? Array.isArray(selectedAnswer) && selectedAnswer.includes(choice.id)
                : selectedAnswer === choice.id
              return (
                <button
                  key={choice.id}
                  type="button"
                  onClick={() => handleSelectLandlord(choice.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-4 py-5 text-left transition-colors ${
                    selected ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
                  }`}
                >
                  <span
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                      isMulti ? '' : 'rounded-full'
                    } ${selected ? 'border-gray-900 bg-gray-900' : 'border-gray-400 bg-white'}`}
                  >
                    {selected && (isMulti ? (
                      <svg className="h-2.5 w-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                    ))}
                  </span>
                  <span className="text-base text-gray-800">{choice.label}</span>
                </button>
              )
            })}
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => (step > 1 ? setStep((value) => value - 1) : navigate('/onboarding/survey/intro'))}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            <Link
              to="/matches"
              className="text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              Skip for now
            </Link>

            {step < totalQuestions ? (
              <button
                type="button"
                onClick={() => canProceed && setStep((value) => value + 1)}
                disabled={!canProceed}
                className="inline-flex items-center gap-2 rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
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
                className="inline-flex items-center gap-2 rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-50"
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

        <p className="mx-auto mt-6 max-w-[520px] text-center text-sm leading-7 text-gray-500">
          Your responses help us understand your preferences and match you with tenants who share similar values and lifestyle choices.
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm md:p-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-lg bg-gray-900 flex items-center justify-center">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900">Tenant Compatibility Survey</h1>
          <p className="text-gray-600 mt-1">Help us match you with compatible landlords and properties.</p>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Question {step} of {totalQuestions}
            </span>
            <span className="text-sm text-gray-500">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gray-800 rounded-full transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <h2 className="text-lg font-semibold text-gray-900 mb-2">{tenantQuestion?.question}</h2>
        <p className="mb-6 text-gray-700">{tenantQuestion?.prompt}</p>

        <div className="space-y-3 mb-8">
          {tenantQuestion?.options.map((option) => (
            <label
              key={option}
              className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                selectedAnswer === option
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <input
                type="radio"
                name={`q${step}`}
                value={option}
                checked={selectedAnswer === option}
                onChange={() => handleSelectTenant(option)}
                className="w-4 h-4 text-gray-900 border-gray-300 focus:ring-gray-900"
              />
              <span className="text-gray-900">{option}</span>
            </label>
          ))}
        </div>

        <div className="flex justify-between gap-4">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
          ) : (
            <Link
              to="/onboarding/survey/intro"
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </Link>
          )}

          {step < totalQuestions ? (
            <button
              type="button"
              onClick={() => canProceed && setStep((s) => s + 1)}
              disabled={!canProceed}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium ${ canProceed ? 'gradient-primary text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed' }`}
            >
              Next
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              disabled={!canProceed}
              onClick={() => canProceed && handleCompleteTenant()}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium ${ canProceed ? 'gradient-primary text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed' }`}
            >
              Complete
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
