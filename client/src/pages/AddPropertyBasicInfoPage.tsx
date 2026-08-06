import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { loadPropertyDraft, savePropertyDraft } from '../lib/propertyDraft'
import { US_STATES } from '../lib/usStates'

export function AddPropertyBasicInfoPage() {
  const navigate = useNavigate()
  const draft = loadPropertyDraft()
  const [propertyName, setPropertyName] = useState(draft.propertyName)
  const [streetAddress, setStreetAddress] = useState(draft.streetAddress)
  const [city, setCity] = useState(draft.city)
  const [state, setState] = useState(draft.state)
  const [zipCode, setZipCode] = useState(draft.zipCode)
  const [monthlyRent, setMonthlyRent] = useState(draft.monthlyRent)
  const [securityDeposit, setSecurityDeposit] = useState(draft.securityDeposit)
  const [leaseTerm, setLeaseTerm] = useState(draft.leaseTerm)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    savePropertyDraft({
      ...loadPropertyDraft(),
      propertyName,
      streetAddress,
      city,
      state,
      zipCode,
      monthlyRent,
      securityDeposit,
      leaseTerm,
    })
  }, [city, leaseTerm, monthlyRent, propertyName, securityDeposit, state, streetAddress, zipCode])

  function handleSaveDraft() {
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="min-h-full px-4 py-10">
      <div className="mx-auto max-w-[544px]">
        <Link
          to="/onboarding/property/intro"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>

        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm">
          <h1 className="text-[2rem] font-medium text-gray-900">Add Property – Basic Info</h1>
          <p className="mt-3 text-sm leading-7 text-gray-600">
            Let&apos;s start with the essential details about your property
          </p>

          <div className="mt-6">
            <div className="mb-2 flex items-center justify-between text-sm text-gray-600">
              <span>Step 1 of 4</span>
              <span>0% Complete</span>
            </div>
            <div className="h-2 rounded-full bg-gray-200">
              <div className="h-2 w-[8%] rounded-full bg-gray-900" />
            </div>
          </div>

          <div className="mt-7 space-y-5">
            <div>
              <label htmlFor="property-name" className="mb-2 block text-sm font-medium text-gray-700">
                Property Name / Nickname <span className="text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <input
                  id="property-name"
                  type="text"
                  value={propertyName}
                  onChange={(event) => setPropertyName(event.target.value)}
                  placeholder="e.g., Downtown Apartment, Cozy Studio..."
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5l9 9-5 5-9-9V3z" />
                </svg>
              </div>
              <p className="mt-2 text-xs text-gray-500">This helps you identify the property in your dashboard</p>
            </div>

            <div>
              <label htmlFor="street-address" className="mb-2 block text-sm font-medium text-gray-700">
                Street Address *
              </label>
              <div className="relative">
                <input
                  id="street-address"
                  type="text"
                  value={streetAddress}
                  onChange={(event) => setStreetAddress(event.target.value)}
                  placeholder="123 Main Street, Unit 4B"
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 pr-10 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_136px_136px]">
              <div>
                <label htmlFor="city" className="mb-2 block text-sm font-medium text-gray-700">
                  City *
                </label>
                <input
                  id="city"
                  type="text"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="San Francisco"
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="state" className="mb-2 block text-sm font-medium text-gray-700">
                  State *
                </label>
                <div className="relative">
                  <select
                    id="state"
                    value={state}
                    onChange={(event) => setState(event.target.value)}
                    className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                  >
                    <option value="">Select</option>
                    {US_STATES.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                  <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              <div>
                <label htmlFor="zip-code" className="mb-2 block text-sm font-medium text-gray-700">
                  ZIP Code *
                </label>
                <input
                  id="zip-code"
                  type="text"
                  value={zipCode}
                  onChange={(event) => setZipCode(event.target.value)}
                  placeholder="94102"
                  className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label htmlFor="monthly-rent" className="mb-2 block text-sm font-medium text-gray-700">
                Monthly Rent *
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <input
                  id="monthly-rent"
                  type="text"
                  value={monthlyRent}
                  onChange={(event) => setMonthlyRent(event.target.value)}
                  placeholder="2,500"
                  className="w-full rounded-lg border border-gray-200 py-3 pl-8 pr-8 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
              </div>
              <p className="mt-2 text-xs text-gray-500">Enter the monthly rental amount (excluding utilities).</p>
            </div>

            <div>
              <label htmlFor="security-deposit" className="mb-2 block text-sm font-medium text-gray-700">
                Security Deposit <span className="text-gray-400">(optional)</span>
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
                <input
                  id="security-deposit"
                  type="text"
                  value={securityDeposit}
                  onChange={(event) => setSecurityDeposit(event.target.value)}
                  placeholder="2,500"
                  className="w-full rounded-lg border border-gray-200 py-3 pl-8 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
              </div>
              <p className="mt-2 text-xs text-gray-500">Leave blank to default to one month&apos;s rent.</p>
            </div>

            <div>
              <label htmlFor="lease-term" className="mb-2 block text-sm font-medium text-gray-700">
                Lease Term *
              </label>
              <div className="relative">
                <select
                  id="lease-term"
                  value={leaseTerm}
                  onChange={(event) => setLeaseTerm(event.target.value)}
                  className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                >
                  <option value="">Select lease duration</option>
                  <option value="6">6 months</option>
                  <option value="12">12 months</option>
                  <option value="18">18 months</option>
                  <option value="24">24 months</option>
                </select>
                <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
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
            onClick={() => navigate('/onboarding/property/community')}
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
