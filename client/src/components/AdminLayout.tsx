import { Link, Navigate, Outlet, useLocation } from 'react-router-dom'
import { LayoutGrid, Users, AlertTriangle, Bell, Settings, User, Building2, type LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { UserMenu } from './UserMenu'

type NavItem = { path: string; label: string; icon: LucideIcon; exact: boolean }

const navItems: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutGrid, exact: true },
  { path: '/admin/users', label: 'Users', icon: Users, exact: false },
  { path: '/admin/properties', label: 'Properties', icon: Building2, exact: false },
  { path: '/admin/issues', label: 'Issues', icon: AlertTriangle, exact: false },
  { path: '/admin/notifications', label: 'Notifications', icon: Bell, exact: false },
  { path: '/admin/settings', label: 'Settings', icon: Settings, exact: false },
  { path: '/admin/profile', label: 'Profile', icon: User, exact: false },
] as const

function Logo() {
  return (
    <Link to="/admin" className="flex items-center gap-3">
      <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-7 w-auto" />
      <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-gray-600">
        Admin
      </span>
    </Link>
  )
}

export function AdminLayout() {
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()
  const { role, loading } = useProfileRole(user)

  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFD]">
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
    <div className="min-h-screen flex flex-col bg-[#F8FAFD] text-gray-600" style={{ fontFamily: "'Inter', sans-serif" }}>
      <header className="bg-white border-b border-gray-200/60 sticky top-0 z-30 h-16 flex items-center shadow-sm">
        <div className="shrink-0 flex items-center px-6 h-full md:w-64 md:border-r border-gray-200/60">
          <Logo />
        </div>
        <div className="flex-1 flex justify-end items-center px-6">
          <UserMenu />
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        <aside className="w-64 shrink-0 bg-white border-r border-gray-200/60 flex-col hidden md:flex">
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                    isActive ? 'bg-[#EEF4FE] text-[#3A7AFE]' : 'text-gray-500 hover:bg-gray-50 hover:text-[#0F1E3D]'
                  }`}
                >
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
        </aside>

        <main className="flex-1 overflow-auto min-w-0 bg-[#F8FAFD]">
          <nav className="md:hidden flex items-center gap-1.5 overflow-x-auto bg-white border-b border-gray-200/60 px-4 py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = item.exact
                ? location.pathname === item.path
                : location.pathname === item.path || location.pathname.startsWith(item.path + '/')
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-semibold ${
                    isActive ? 'bg-[#EEF4FE] text-[#3A7AFE]' : 'text-gray-500'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </Link>
              )
            })}
          </nav>

          <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-10">
            <Outlet />
          </div>
        </main>
      </div>

      <footer className="bg-white border-t border-gray-200/60 py-6 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 lg:px-8">
          <span className="text-sm text-gray-500">© 2026 Rental City. All rights reserved.</span>
          <nav className="flex items-center gap-6 text-sm font-medium text-gray-500">
            <Link to="/about" className="hover:text-[#0F1E3D] transition-colors">About</Link>
            <Link to="/privacy" className="hover:text-[#0F1E3D] transition-colors">Privacy</Link>
            <Link to="/terms" className="hover:text-[#0F1E3D] transition-colors">Terms</Link>
            <Link to="/support" className="hover:text-[#0F1E3D] transition-colors">Support</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
