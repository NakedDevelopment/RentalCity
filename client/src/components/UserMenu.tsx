import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

export function UserMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [])

  async function handleSignOut() {
    await supabase.auth.signOut()
    setOpen(false)
    navigate('/login', { replace: true })
  }

  if (!user) {
    return (
      <Link
        to="/login"
        className="w-9 h-9 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 hover:bg-gray-200"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </Link>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-white font-medium text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
        aria-label="Account menu"
        aria-expanded={open}
      >
        {user.email?.[0]?.toUpperCase() ?? 'U'}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
          <div className="px-4 py-2 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 break-all">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
