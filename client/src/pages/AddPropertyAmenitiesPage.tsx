import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadPropertyDraft, savePropertyDraft } from '../lib/propertyDraft'

const propertyFeatures = [
  'Pool',
  'Parking',
  'Washer/Dryer',
  'Air Conditioning',
  'Furnished',
  'Pets Allowed',
]

const additionalAmenities = [
  'Gym/Fitness Center',
  'Balcony/Patio',
  'Dishwasher',
  'Hardwood Floors',
]

function AmenityCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex w-full items-center gap-3 rounded-lg border px-4 py-4 text-left transition-colors ${
        checked ? 'border-gray-900 bg-gray-50' : 'border-gray-200 bg-white hover:bg-gray-50'
      }`}
    >
      <span className={`flex h-4 w-4 items-center justify-center rounded-sm border ${checked ? 'border-gray-900 bg-gray-900' : 'border-gray-300 bg-white'}`}>
        {checked ? <span className="h-1.5 w-1.5 rounded-sm bg-white" /> : null}
      </span>
      <span className="text-sm text-gray-800">{label}</span>
    </button>
  )
}

export function AddPropertyAmenitiesPage() {
  const navigate = useNavigate()
  const draft = loadPropertyDraft()
  const [bedrooms, setBedrooms] = useState(draft.bedrooms)
  const [bathrooms, setBathrooms] = useState(draft.bathrooms)
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>(draft.amenities)
  const [saved, setSaved] = useState(false)

  function toggleAmenity(label: string) {
    setSelectedAmenities((current) =>
      current.includes(label) ? current.filter((item) => item !== label) : [...current, label]
    )
  }

  useEffect(() => {
    savePropertyDraft({
      ...loadPropertyDraft(),
      bedrooms,
      bathrooms,
      amenities: selectedAmenities,
    })
  }, [bathrooms, bedrooms, selectedAmenities])

  function handleSaveDraft() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto max-w-[544px]">
        <Link
          to="/onboarding/property/community"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
          <h1 className="text-[2rem] font-medium text-gray-900">Property Amenities</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Select the amenities available at your property to help tenants find the perfect match.
          </p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>Step 3 of 4</span>
              <span>50% Complete</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 w-1/2 rounded-full bg-gray-900" />
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-[1.35rem] font-medium text-gray-900">Basic Information</h2>
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
              <div>
                <label htmlFor="bedrooms" className="mb-2 block text-sm font-medium text-gray-700">
                  Bedrooms
                </label>
                <div className="relative">
                  <select
                    id="bedrooms"
                    value={bedrooms}
                    onChange={(event) => setBedrooms(event.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                  >
                    <option value="">Select bedrooms</option>
                    <option value="studio">Studio</option>
                    <option value="1">1 Bedroom</option>
                    <option value="2">2 Bedrooms</option>
                    <option value="3">3 Bedrooms</option>
                    <option value="4+">4+ Bedrooms</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div>
                <label htmlFor="bathrooms" className="mb-2 block text-sm font-medium text-gray-700">
                  Bathrooms
                </label>
                <div className="relative">
                  <select
                    id="bathrooms"
                    value={bathrooms}
                    onChange={(event) => setBathrooms(event.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                  >
                    <option value="">Select bathrooms</option>
                    <option value="1">1 Bathroom</option>
                    <option value="1.5">1.5 Bathrooms</option>
                    <option value="2">2 Bathrooms</option>
                    <option value="3+">3+ Bathrooms</option>
                  </select>
                  <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-[1.35rem] font-medium text-gray-900">Property Features</h2>
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
              {propertyFeatures.map((feature) => (
                <AmenityCheckbox
                  key={feature}
                  label={feature}
                  checked={selectedAmenities.includes(feature)}
                  onChange={() => toggleAmenity(feature)}
                />
              ))}
            </div>
          </div>

          <div className="mt-8">
            <h2 className="text-[1.35rem] font-medium text-gray-900">Additional Amenities</h2>
            <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 sm:grid-cols-2">
              {additionalAmenities.map((amenity) => (
                <AmenityCheckbox
                  key={amenity}
                  label={amenity}
                  checked={selectedAmenities.includes(amenity)}
                  onChange={() => toggleAmenity(amenity)}
                />
              ))}
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
            onClick={() => navigate('/onboarding/property/photos')}
            className="inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-3 text-sm font-medium text-white"
          >
            Next: Upload Photos
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
