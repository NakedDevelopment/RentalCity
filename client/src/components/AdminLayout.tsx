import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'
import { UserMenu } from './UserMenu'

const navItems = [
  { path: '/admin', label: 'Dashboard', exact: true },
  { path: '/admin/users', label: 'Users', exact: false },
  { path: '/admin/issues', label: 'Issues', exact: false },
  { path: '/admin/notifications', label: 'Notifications', exact: false },
  { path: '/admin/settings', label: 'Settings', exact: false },
  { path: '/admin/profile', label: 'Profile', exact: false },
] as const

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    dashboard: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
    users: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
    issues: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
    bell: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    person: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  }
  return icons[name] ?? icons.dashboard
}

const iconByPath: Record<string, string> = {
  '/admin': 'dashboard',
  '/admin/users': 'users',
  '/admin/issues': 'issues',
  '/admin/notifications': 'bell',
  '/admin/settings': 'settings',
  '/admin/profile': 'person',
}

export function AdminLayout() {
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { role, loading } = useProfileRole(user)

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (role !== 'admin') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <div className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col pl-2 pr-4">
        <header className="relative z-10 shrink-0 border-b bg-white -mx-4 pl-2 pr-4">
          <div className="flex items-center">
            <Link to="/admin" className="flex items-center gap-2 text-xl font-semibold text-gray-900">
              <svg className="h-6 w-6 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Rental City
            </Link>
            <span className="ml-3 rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
              Admin
            </span>
            <div className="mr-4 w-56 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-1 justify-end">
              <nav className="flex items-center gap-2 py-4">
                <UserMenu />
              </nav>
            </div>
          </div>
        </header>

        <div className="-ml-4 -mr-4 flex min-h-0 flex-1">
          <aside className="relative z-10 mr-4 flex w-56 shrink-0 flex-col bg-white text-gray-900 border-r border-gray-100">
            <nav className="flex-1 space-y-1 p-4 pt-4">
              {navItems.map((item) => {
                const active = item.exact
                  ? location.pathname === item.path
                  : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
                const icon = iconByPath[item.path] ?? 'dashboard'
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 rounded-lg px-4 py-3 text-sm transition-colors ${
                      active ? 'bg-primary text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <NavIcon name={icon} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>

          <div className="flex min-w-0 flex-1 flex-col">
            <main className="min-w-0 flex-1 overflow-auto">
              <div className="w-full shrink-0 pt-4 pb-6">
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        <footer className="relative z-10 shrink-0 border-t bg-white py-6 -mx-4 pl-2 pr-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-600">© 2026 Rental City. All rights reserved.</span>
            <div className="mr-4 w-56 shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-1 justify-end">
              <nav className="flex items-center gap-6 text-sm text-gray-600">
                <Link to="/about" className="hover:text-gray-900">
                  About
                </Link>
                <Link to="/privacy" className="hover:text-gray-900">
                  Privacy
                </Link>
                <Link to="/terms" className="hover:text-gray-900">
                  Terms
                </Link>
                <Link to="/support" className="hover:text-gray-900">
                  Support
                </Link>
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
