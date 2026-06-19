import { Outlet, Link } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'

function Logo() {
  return (
    <Link to="/" className="flex items-center">
      <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-7 w-auto" />
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
