import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

type Timing = 'immediate' | 'future'

export function RentalNeedsPage() {
  const [timing, setTiming] = useState<Timing | null>(null)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSave() {
    if (!timing || !user) return
    setLoading(true)
    const moveInDate = timing === 'immediate' ? new Date().toISOString().slice(0, 10) : null
    const payload = { user_id: user.id, move_in_date: moveInDate }
    const { data: existing } = await supabase
      .from('tenant_preferences')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()
    if (existing) {
      await supabase.from('tenant_preferences').update({ move_in_date: moveInDate }).eq('user_id', user.id)
    } else {
      await supabase.from('tenant_preferences').insert(payload)
    }
    setLoading(false)
    navigate('/lease-preferences')
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <Link to="/onboarding/role" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
          ← Back
        </Link>
        <button type="button" className="text-gray-600 hover:text-gray-900" onClick={() => navigate('/matches')}>
          Skip
        </button>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-6">
        Are you looking to rent for an immediate need or planning ahead for a future date?
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          type="button"
          onClick={() => setTiming('immediate')}
          className={`p-6 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
            timing === 'immediate' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium text-gray-900">Immediate need</span>
        </button>
        <button
          type="button"
          onClick={() => setTiming('future')}
          className={`p-6 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
            timing === 'future' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="font-medium text-gray-900">Future need</span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!timing || loading}
        className="w-full py-3 btn-primary text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
