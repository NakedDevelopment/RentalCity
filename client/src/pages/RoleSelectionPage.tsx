import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'

type Role = 'tenant' | 'landlord'

export function RoleSelectionPage() {
  const [role, setRole] = useState<Role | null>(null)
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

  async function handleSave() {
    if (!role || !user) return
    setLoading(true)
    await supabase.from('profiles').update({ role }).eq('id', user.id)
    setLoading(false)
    // Tenants → rental needs in app shell; Landlords → profile setup
    navigate(role === 'tenant' ? '/rental-needs' : '/onboarding/profile')
  }

  return (
    <div className="max-w-md mx-auto py-12 px-4">
      <div className="flex items-center justify-between mb-8">
        <Link to="/onboarding" className="text-gray-600 hover:text-gray-900 flex items-center gap-1">
          ← Back
        </Link>
        <button type="button" className="text-gray-600 hover:text-gray-900" onClick={() => navigate('/matches')}>
          Skip
        </button>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-6 text-center">
        Are you here to find a place to rent or list your property for others to rent?
      </h2>

      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          type="button"
          onClick={() => setRole('tenant')}
          className={`p-6 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
            role === 'tenant' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <span className="font-medium text-gray-900">I'm here to find a place to rent</span>
        </button>
        <button
          type="button"
          onClick={() => setRole('landlord')}
          className={`p-6 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
            role === 'landlord' ? 'border-emerald-600 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
          <span className="font-medium text-gray-900 text-center">I want to list my property</span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!role || loading}
        className="w-full py-3 btn-primary text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Saving...' : 'Save'}
      </button>
    </div>
  )
}
