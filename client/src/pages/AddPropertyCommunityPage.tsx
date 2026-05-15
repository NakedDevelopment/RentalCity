import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadPropertyDraft, savePropertyDraft } from '../lib/propertyDraft'

export function AddPropertyCommunityPage() {
  const navigate = useNavigate()
  const draft = loadPropertyDraft()
  const [communityDescription, setCommunityDescription] = useState(draft.communityDescription)
  const [saved, setSaved] = useState(false)
  const minimumLength = 200

  useEffect(() => {
    savePropertyDraft({
      ...loadPropertyDraft(),
      communityDescription,
    })
  }, [communityDescription])

  function handleSaveDraft() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto max-w-[544px]">
        <Link
          to="/onboarding/property/basic-info"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
          <h1 className="text-[2rem] font-medium text-gray-900">Community Description</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Tell potential tenants about the community around your property. Be detailed and honest to attract the right matches
          </p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>Step 2 of 4</span>
              <span>25% Complete</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 w-1/4 rounded-full bg-gray-900" />
            </div>
          </div>

          <div className="mt-7">
            <label htmlFor="community-description" className="mb-3 block text-sm font-medium text-gray-700">
              Community Description
            </label>
            <textarea
              id="community-description"
              value={communityDescription}
              onChange={(event) => setCommunityDescription(event.target.value)}
              placeholder="Describe your the community around your property in detail. Include information about the neighborhood, property special. The more detail you provide, the better we can match you nearby amenities, transportation, unique features, and what makes this with compatible tenants."
              rows={7}
              className="w-full rounded-lg border border-gray-200 px-4 py-4 text-sm leading-8 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end text-xs text-gray-500">
              {communityDescription.length} / {minimumLength} min
            </div>
            <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
              <svg className="h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              minimum 200 characters recommended for better matching
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
            <div className="flex items-start gap-3">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M5.93 19h12.14c1.54 0 2.5-1.67 1.73-3L13.73 5c-.77-1.33-2.69-1.33-3.46 0L4.2 16c-.77 1.33.19 3 1.73 3z" />
              </svg>
              <div>
                <p className="text-sm font-medium text-gray-900">Writing Tips</p>
                <ul className="mt-3 space-y-2 text-sm text-gray-600">
                  <li>• Describe the neighborhood and local attractions</li>
                  <li>• Mention transportation options and commute times</li>
                  <li>• Highlight unique features and recent updates</li>
                  <li>• Include information about parking and storage</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={handleSaveDraft}
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Save as Draft
          </button>

          <button
            type="button"
            onClick={() => navigate('/onboarding/property/amenities')}
            className="inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-3 text-sm font-medium text-white"
          >
            Next: Amenities
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm leading-6 text-gray-700">
              <span className="font-medium text-gray-900">Need help?</span> Make sure your address is accurate as this will be used for tenant searches and background verification.
            </p>
          </div>
        </div>

        {saved ? <p className="mt-4 text-sm text-emerald-600">Draft saved for this browser session.</p> : null}
      </div>
    </div>
  )
}
