import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

export function EditBioPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [bio, setBio] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('bio')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.bio?.trim()) setBio(data.bio.trim())
      })
  }, [user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || loading) return
    setLoading(true)
    const { error } = await supabase
      .from('profiles')
      .update({ bio: bio.trim() || null })
      .eq('id', user.id)
    setLoading(false)
    if (!error) navigate('/account')
  }

  if (!user) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-8">
      <Link
        to="/account"
        className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to profile
      </Link>
      <h1 className="text-[1.5rem] font-medium text-gray-900">Edit bio</h1>
      <p className="mt-1 text-sm text-gray-600">
        Introduce yourself to landlords. Share your lifestyle, work, and what kind of tenant you are.
      </p>
      <form onSubmit={handleSave} className="mt-6">
        <textarea
          rows={5}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="e.g. I'm a remote software engineer who works from home. I enjoy quiet evenings and keep a tidy space."
          className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
        />
        <div className="mt-6 flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <Link
            to="/account"
            className="rounded-lg border border-gray-200 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
