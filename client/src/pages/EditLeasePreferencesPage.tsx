import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const LEASE_LENGTH_OPTIONS = [
  { value: 6, label: '6 months' },
  { value: 12, label: '1 year' },
  { value: 24, label: '2 years' },
]

export function EditLeasePreferencesPage({
  backPath = '/account',
  nextPath = '/account',
  cancelPath,
  backLabel = 'Back to profile',
  cancelLabel = 'Cancel',
  title = 'Edit lease preferences',
  subtitle = 'Update your move-in date, lease length, budget, and pet situation.',
  framed = false,
}: {
  backPath?: string
  nextPath?: string
  cancelPath?: string
  backLabel?: string
  cancelLabel?: string
  title?: string
  subtitle?: string
  framed?: boolean
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [leaseLengthMonths, setLeaseLengthMonths] = useState<number | ''>('')
  const [moveInDate, setMoveInDate] = useState('')
  const [asap, setAsap] = useState(false)
  const [minBudget, setMinBudget] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [hasPets, setHasPets] = useState<boolean | null>(null)
  const [livingSituation, setLivingSituation] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('tenant_preferences')
      .select('lease_length_months, move_in_date, min_budget_cents, max_budget_cents, has_pets, living_situation')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (data.lease_length_months != null) setLeaseLengthMonths(data.lease_length_months)
          if (data.move_in_date) {
            setMoveInDate(data.move_in_date)
            setAsap(false)
          } else {
            setAsap(true)
          }
          if (data.min_budget_cents != null) setMinBudget(String(data.min_budget_cents / 100))
          if (data.max_budget_cents != null) setMaxBudget(String(data.max_budget_cents / 100))
          if (data.has_pets != null) setHasPets(data.has_pets)
          if (data.living_situation?.trim()) setLivingSituation(data.living_situation.trim())
        }
      })
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)
    const minCents = minBudget.trim() ? Math.round(parseFloat(minBudget.replace(/[^0-9.]/g, '')) * 100) : null
    const maxCents = maxBudget.trim() ? Math.round(parseFloat(maxBudget.replace(/[^0-9.]/g, '')) * 100) : null
    const moveIn = asap ? null : (moveInDate || null)
    const updatePayload = {
      lease_length_months: leaseLengthMonths === '' ? null : leaseLengthMonths,
      move_in_date: moveIn,
      min_budget_cents: minCents,
      max_budget_cents: maxCents,
      has_pets: hasPets,
      living_situation: livingSituation.trim() || null,
    }
    const { data: existing } = await supabase
      .from('tenant_preferences')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    const { error: saveError } = existing
      ? await supabase.from('tenant_preferences').update(updatePayload).eq('user_id', user.id)
      : await supabase.from('tenant_preferences').insert({ user_id: user.id, ...updatePayload })
    setLoading(false)
    if (saveError) {
      setError('Could not save. Please try again.')
      return
    }
    navigate(nextPath)
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className={`mx-auto px-4 py-8 ${framed ? 'max-w-[560px]' : 'max-w-lg'}`}>
      <div className={framed ? 'rounded-2xl border border-gray-200 bg-white px-6 py-6 shadow-sm' : ''}>
      <Link
        to={backPath}
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        {backLabel}
      </Link>
      <h1 className="text-[1.5rem] font-medium text-gray-900">{title}</h1>
      <p className="mt-1 text-sm text-gray-600">
        {subtitle}
      </p>
      <form onSubmit={handleSave} className="mt-6 space-y-6">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Lease length</label>
          <select
            value={leaseLengthMonths === '' ? '' : leaseLengthMonths}
            onChange={(e) => setLeaseLengthMonths(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
          >
            <option value="">Select</option>
            {LEASE_LENGTH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Move-in date</label>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={asap}
                onChange={(e) => {
                  setAsap(e.target.checked)
                  if (e.target.checked) setMoveInDate('')
                }}
                className="rounded border-gray-300"
              />
              <span className="text-sm text-gray-700">ASAP / flexible</span>
            </label>
          </div>
          {!asap && (
            <input
              type="date"
              value={moveInDate}
              onChange={(e) => setMoveInDate(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Min budget ($/month)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1200"
              value={minBudget}
              onChange={(e) => setMinBudget(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Max budget ($/month)</label>
            <input
              type="text"
              inputMode="numeric"
              placeholder="e.g. 2000"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Do you have pets?</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasPets"
                checked={hasPets === true}
                onChange={() => setHasPets(true)}
                className="border-gray-300"
              />
              <span className="text-sm text-gray-700">Yes</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="hasPets"
                checked={hasPets === false}
                onChange={() => setHasPets(false)}
                className="border-gray-300"
              />
              <span className="text-sm text-gray-700">No</span>
            </label>
          </div>
          {hasPets && (
            <input
              type="text"
              placeholder="Describe your pets (e.g. 1 dog, 1 cat)"
              value={livingSituation}
              onChange={(e) => setLivingSituation(e.target.value)}
              className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
            />
          )}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg btn-primary px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <Link
            to={cancelPath ?? backPath}
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {cancelLabel}
          </Link>
        </div>
      </form>
      </div>
    </div>
  )
}
