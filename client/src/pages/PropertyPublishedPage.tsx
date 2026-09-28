import { Link, useSearchParams } from 'react-router-dom'
import { PropertyInviteLink } from '../components/PropertyInviteLink'

const nextSteps = [
  { title: 'Share your property link', description: 'Send the link to potential tenants or post it on rental platforms' },
  { title: 'Review applications', description: 'Get notified when tenants apply and review their profiles' },
  { title: 'Find your perfect match', description: 'Use our personality matching to find compatible tenants' },
]

export function PropertyPublishedPage() {
  const [searchParams] = useSearchParams()

  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <div className="w-full text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-white">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="mt-5 text-[2rem] font-medium text-gray-900">Property Published!</h1>
        <p className="mt-3 text-base text-gray-600">Your property is now live and ready to receive applications.</p>

        <div className="mt-8"><PropertyInviteLink propertyId={searchParams.get('id')} /></div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link to="/account"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Go to Dashboard
          </Link>
          <Link to="/onboarding/property/intro"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Add Another Property
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left">
          <h2 className="text-[1.35rem] font-medium text-gray-900">What happens next?</h2>
          <div className="mt-5 space-y-5">
            {nextSteps.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{step.title}</p>
                  <p className="mt-1 text-sm text-gray-500">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}