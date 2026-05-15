import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function ApplicationFormPage() {
  const navigate = useNavigate()
  const [message, setMessage] = useState('')

  const TOTAL_STEPS = 1

  return (
    <div className="px-4 py-8">
      <div className="max-w-[640px]">
        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="text-sm text-gray-700">Step 1 of {TOTAL_STEPS}</p>
            <p className="text-sm text-gray-500">100% Complete</p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-gray-200">
            <div className="h-full w-full rounded-full bg-gray-900" />
          </div>
        </div>

        <div className="mb-7">
          <h1 className="mb-2 text-[2rem] font-semibold tracking-tight text-gray-900">
            Submit your application
          </h1>
          <p className="text-sm text-gray-600">
            We&apos;ll attach your saved profile, universal application, and lease preferences to this
            property. You can add an optional note to the landlord below.
          </p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 md:p-6">
          <div className="space-y-5">
            <div className="rounded-xl bg-gray-50 px-4 py-4 text-sm text-gray-700">
              <p className="font-medium text-gray-900">What&apos;s included</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-gray-700">
                <li>Personal information from your profile</li>
                <li>Lease preferences and questionnaire answers</li>
                <li>Rental and employment history from your universal application</li>
              </ul>
              <p className="mt-3 text-xs text-gray-500">
                To update any of these details, go to <span className="font-medium">My Profile</span> before
                submitting this application.
              </p>
            </div>

            <div>
              <label htmlFor="message" className="mb-2 block text-sm font-medium text-gray-800">
                Message to landlord (optional)
              </label>
              <textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Introduce yourself, share why this home is a good fit, or add any details you want the landlord to know."
                className="w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>

          <div className="mt-8 flex items-center justify-between gap-4">
            <Link
              to="/matches?tab=applied"
              className="inline-flex min-w-[120px] items-center justify-center gap-2 rounded-xl border border-gray-300 px-5 py-3 text-base font-medium text-gray-700 hover:bg-gray-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Cancel
            </Link>
            <button
              type="button"
              onClick={() => navigate('/matches?tab=applied')}
              className="inline-flex min-w-[160px] items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-base font-medium text-white hover:bg-primary/90"
            >
              Submit application
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
