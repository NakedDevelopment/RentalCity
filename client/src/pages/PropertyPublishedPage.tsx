import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

const nextSteps = [
  {
    title: 'Share your application link',
    description: 'Send the link to potential tenants or post it on rental platforms',
  },
  {
    title: 'Review applications',
    description: 'Get notified when tenants apply and review their profiles',
  },
  {
    title: 'Find your perfect match',
    description: 'Use our personality matching to find compatible tenants',
  },
]

export function PropertyPublishedPage() {
  const [searchParams] = useSearchParams()
  const [copied, setCopied] = useState(false)
  const propertyId = searchParams.get('id') ?? 'property'
  const applicationLink =
    typeof window === 'undefined'
      ? `https://rentalcity.com/applications/apply?property=${propertyId}`
      : `${window.location.origin}/applications/apply?property=${propertyId}`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(applicationLink)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <div className="w-full text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-white">
          <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="mt-5 text-[2rem] font-medium text-gray-900">Property Published!</h1>
        <p className="mt-3 text-base text-gray-600">
          Your property is now live and ready to receive applications.
        </p>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-[1.35rem] font-medium text-gray-900">Tenant Application Link</h2>
              <p className="mt-2 text-sm text-gray-500">Share this link with potential tenants</p>
            </div>
            <svg className="mt-1 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 010 5.656l-3 3a4 4 0 11-5.656-5.656l1.5-1.5M10.172 13.828a4 4 0 010-5.656l3-3a4 4 0 115.656 5.656l-1.5 1.5" />
            </svg>
          </div>

          <div className="mt-5 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <span className="truncate pr-4 text-sm text-gray-600">{applicationLink}</span>
            <button
              type="button"
              onClick={handleCopy}
              aria-label="Copy application link"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={handleCopy}
            className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            {copied ? 'Link Copied' : 'Copy Tenant Application Link'}
          </button>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <Link
            to="/account"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Go to Dashboard
          </Link>

          <Link
            to="/onboarding/property/intro"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Another Property
          </Link>
        </div>

        <section className="mt-8 rounded-2xl border border-gray-200 bg-white p-6 text-left">
          <h2 className="text-[1.35rem] font-medium text-gray-900">What happens next?</h2>
          <div className="mt-5 space-y-5">
            {nextSteps.map((step, index) => (
              <div key={step.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
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
