import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'

export function LandlordMatchPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { role: profileRole, landlordSurveyCompletedAt, loading: roleLoading } = useProfileRole(user)

  useEffect(() => {
    if (roleLoading || profileRole !== 'landlord') return
    if (landlordSurveyCompletedAt) {
      navigate('/onboarding/property/intro', { replace: true })
    }
  }, [roleLoading, profileRole, landlordSurveyCompletedAt, navigate])

  if (roleLoading || (profileRole === 'landlord' && landlordSurveyCompletedAt)) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  const steps = [
    { number: 1, label: 'Account Created', complete: true, active: false },
    { number: 2, label: 'Profile Setup', complete: true, active: false },
    { number: 3, label: 'Landlord Survey', complete: false, active: true },
    { number: 4, label: 'Add Property', complete: false, active: false },
  ]

  const howItWorks = [
    {
      number: 1,
      title: 'Take Survey',
      description: 'Answer 10 questions about your preferences and communication style',
    },
    {
      number: 2,
      title: 'Get Matched',
      description: 'Our algorithm finds tenants with compatible personalities and lifestyles',
    },
    {
      number: 3,
      title: 'Connect',
      description: 'Review matched tenant profiles and start conversations with confidence',
    },
  ]

  return (
    <div className="min-h-full">
      <div className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-5">
          {steps.map((step, index) => (
            <div key={step.label} className="flex min-w-0 flex-1 items-center">
              <div className="flex items-center gap-3">
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    step.complete || step.active
                      ? 'gradient-primary text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  {step.complete ? (
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step.number
                  )}
                </span>
                <span className={`text-sm ${step.active || step.complete ? 'text-gray-900' : 'text-gray-500'}`}>
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 ? <div className="mx-4 h-px flex-1 bg-gray-200" /> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-12">
        <div className="mx-auto max-w-[544px] rounded-2xl border border-gray-200 bg-white px-8 py-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-700">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9l2 2 4-4" />
            </svg>
          </div>

          <h1 className="text-[2rem] font-medium text-gray-900">Smart Tenant Matching</h1>
          <p className="mx-auto mt-4 max-w-[430px] text-base leading-8 text-gray-600">
            Our proprietary personality survey creates better landlord-tenant matches, reducing turnover and improving rental experiences.
          </p>

          <h2 className="mt-8 text-[1.55rem] font-medium text-gray-900">How Our Matching Works</h2>

          <div className="mx-auto mt-7 max-w-[330px] space-y-6 text-left">
            {howItWorks.map((item) => (
              <div key={item.number} className="flex items-start gap-4">
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full gradient-primary text-xs font-medium text-white">
                  {item.number}
                </span>
                <div>
                  <h3 className="text-[1.1rem] font-medium text-gray-900">{item.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 text-left">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Complete Survey to Start Matching</p>
                <p className="mt-1 text-sm leading-7 text-gray-600">
                  You won&apos;t receive tenant matches until you complete your personality survey. This ensures we can find the best possible compatibility.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/onboarding/survey"
            className="inline-flex items-center gap-2 rounded-lg btn-primary px-8 py-3 text-sm font-medium text-white"
          >
            Take the Survey
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>

          <p className="mt-5 text-sm text-gray-500">Takes about 10 minutes • You can save and continue later</p>
        </div>

        <div className="mt-8 flex items-center justify-center gap-2 text-sm text-gray-500">
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11V9a4 4 0 118 0v2M5 11h14v8a2 2 0 01-2 2H7a2 2 0 01-2-2v-8z" />
          </svg>
          Your survey responses are private and only used for matching purposes
        </div>
      </div>
    </div>
  )
}
