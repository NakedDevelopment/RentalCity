/**
 * CreditConsentCard — tenant-facing form to authorize credit checks.
 * Collects name, SSN, and current address; encrypts server-side. No
 * raw SSN is ever stored locally or returned from the server.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { saveConsentData, getConsentStatus } from '../lib/equifaxApi'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? null
}

export function CreditConsentCard({ isApplicationActive }: { isApplicationActive: boolean }) {
  const [hasConsent, setHasConsent] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Form fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ssn, setSsn] = useState('')
  const [houseNumber, setHouseNumber] = useState('')
  const [streetName, setStreetName] = useState('')
  const [streetType, setStreetType] = useState('ST')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')

  useEffect(() => {
    if (!isApplicationActive) { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const token = await getAccessToken()
      if (!token || cancelled) { setLoading(false); return }
      try {
        const { hasConsent: hc } = await getConsentStatus(token)
        if (!cancelled) setHasConsent(hc)
      } catch {
        if (!cancelled) setHasConsent(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [isApplicationActive])

  // Format SSN as user types: 123-45-6789
  const handleSsnChange = useCallback((raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 9)
    let formatted = digits
    if (digits.length > 5) formatted = `${digits.slice(0,3)}-${digits.slice(3,5)}-${digits.slice(5)}`
    else if (digits.length > 3) formatted = `${digits.slice(0,3)}-${digits.slice(3)}`
    setSsn(formatted)
  }, [])

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    const ssnDigits = ssn.replace(/\D/g, '')
    if (ssnDigits.length !== 9) { setError('Please enter a valid 9-digit SSN.'); return }
    if (!state) { setError('Please select a state.'); return }
    setSaving(true)
    try {
      const token = await getAccessToken()
      if (!token) throw new Error('Please sign in again.')
      await saveConsentData(token, {
        firstName, lastName, ssn: ssnDigits,
        houseNumber, streetName, streetType, city, state, zip,
      })
      setHasConsent(true)
      setSuccess(true)
      // Clear SSN from state immediately
      setSsn('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your information')
    } finally {
      setSaving(false)
    }
  }, [firstName, lastName, ssn, houseNumber, streetName, streetType, city, state, zip])

  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none'
  const labelCls = 'block text-xs font-medium text-gray-600 mb-1'

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-900">Credit Check Authorization</h2>
        {hasConsent && (
          <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
            <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            On file
          </span>
        )}
      </div>

      {!isApplicationActive ? (
        <p className="text-sm text-gray-600">Start or renew your application to authorize a credit check.</p>
      ) : loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : hasConsent ? (
        <div className="space-y-3">
          <div className="rounded-lg border border-green-100 bg-green-50 p-3">
            <p className="text-sm text-green-800">
              Your credit check information is on file. Approved landlords can request
              a credit report — we contact Equifax directly, and no credit data is stored
              on our servers.
            </p>
          </div>
          <button
            type="button"
            onClick={() => { setHasConsent(false); setSuccess(false) }}
            className="text-xs text-gray-400 underline hover:text-gray-600"
          >
            Update my information
          </button>
        </div>
      ) : (
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <p className="text-sm text-gray-600">
            Authorize landlords to run a credit check by providing your information once.
            Your SSN is encrypted and never shown to landlords — only Equifax receives it.
          </p>

          {success && (
            <div className="rounded-lg border border-green-100 bg-green-50 p-3">
              <p className="text-sm text-green-800">Information saved. Landlords can now request a credit check.</p>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>First name</label>
              <input
                type="text"
                required
                maxLength={15}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={inputCls}
                placeholder="Jane"
                autoComplete="given-name"
              />
            </div>
            <div>
              <label className={labelCls}>Last name</label>
              <input
                type="text"
                required
                maxLength={25}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className={inputCls}
                placeholder="Smith"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Social Security Number</label>
            <input
              type="text"
              required
              value={ssn}
              onChange={(e) => handleSsnChange(e.target.value)}
              className={inputCls}
              placeholder="123-45-6789"
              autoComplete="off"
              inputMode="numeric"
              maxLength={11}
            />
            <p className="mt-1 text-xs text-gray-400">Encrypted immediately — never stored in plain text</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <label className={labelCls}>House number</label>
              <input
                type="text"
                required
                value={houseNumber}
                onChange={(e) => setHouseNumber(e.target.value)}
                className={inputCls}
                placeholder="123"
              />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Street name</label>
              <input
                type="text"
                required
                value={streetName}
                onChange={(e) => setStreetName(e.target.value)}
                className={inputCls}
                placeholder="Main"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <label className={labelCls}>Type</label>
              <select
                value={streetType}
                onChange={(e) => setStreetType(e.target.value)}
                className={inputCls}
              >
                {['ST','AVE','BLVD','DR','RD','LN','CT','PL','WAY','CIR'].map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>City</label>
              <input
                type="text"
                required
                maxLength={20}
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className={inputCls}
                placeholder="Atlanta"
                autoComplete="address-level2"
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className={labelCls}>State</label>
              <select
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className={inputCls}
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>ZIP code</label>
              <input
                type="text"
                required
                value={zip}
                onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
                className={inputCls}
                placeholder="30301"
                inputMode="numeric"
                maxLength={5}
                autoComplete="postal-code"
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Authorize credit checks'}
          </button>

          <p className="text-center text-xs text-gray-400">
            By submitting you consent to a credit report being pulled by approved landlords
            through Equifax on behalf of Rental City.
          </p>
        </form>
      )}
    </section>
  )
}
