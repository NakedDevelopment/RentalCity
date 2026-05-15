import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-semibold text-xl text-gray-900">
      <svg className="w-6 h-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
      Rental City
    </Link>
  )
}

export function Layout() {
  const { user } = useAuth()

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <header className="bg-white border-b">
        <nav className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            {user ? (
              <span className="text-gray-600 text-sm">{user.email}</span>
            ) : null}
          </div>
        </nav>
      </header>
      <main className="flex-1 flex flex-col max-w-6xl w-full mx-auto">
        <Outlet />
      </main>
      <footer className="bg-white border-t py-6">
        <nav className="max-w-6xl mx-auto px-4 flex items-center justify-between text-sm text-gray-600">
          <span>© 2026 Rental City. All rights reserved.</span>
          <div className="flex gap-6">
            <Link to="/about" className="hover:text-gray-900">About</Link>
            <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
            <Link to="/terms" className="hover:text-gray-900">Terms</Link>
            <Link to="/support" className="hover:text-gray-900">Support</Link>
          </div>
        </nav>
      </footer>
    </div>
  )
}
