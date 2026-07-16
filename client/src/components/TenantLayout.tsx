import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { LayoutGrid, User, Mail, Settings as SettingsIcon, Building2, Bell, Calculator, type LucideIcon } from 'lucide-react'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { useRedeemPendingLandlordInvite } from '../lib/useRedeemPendingLandlordInvite'
import { useTenantInviteRestriction } from '../lib/useTenantInviteRestriction'
import { TENANT_SIDE_ENABLED } from '../lib/featureFlags'
import { TenantInviteBanner } from './TenantInviteBanner'
import { TenantSideComingSoon } from './TenantSideComingSoon'
import { UserMenu } from './UserMenu'

type NavItem = { path: string; label: string; icon: LucideIcon; external?: boolean }

const tenantNavItems: NavItem[] = [
  { path: '/matches', label: 'Matches', icon: LayoutGrid },
  { path: '/account', label: 'My Profile', icon: User },
  { path: '/messages', label: 'Inbox', icon: Mail },
  { path: '/account/settings', label: 'Settings', icon: SettingsIcon },
]

const landlordNavItems: NavItem[] = [
  { path: '/matches', label: 'Matches', icon: LayoutGrid },
  { path: '/properties', label: 'Properties', icon: Building2 },
  { path: '/messages', label: 'Inbox', icon: Mail },
  { path: '/account', label: 'My Profile', icon: User },
  { path: '/account/settings', label: 'Settings', icon: SettingsIcon },
  { path: 'https://value.gorentalcity.com/', label: 'Rental Value', icon: Calculator, external: true },
]

// For /account/settings, we need to match when path is exactly /account/settings
// For /, match only exactly (not /matches etc.)
function isNavActive(pathname: string, itemPath: string) {
  if (itemPath === '/') return pathname === '/'
  if (itemPath === '/account') {
    return pathname === '/account' || pathname.startsWith('/account/edit')
  }
  return pathname === itemPath || pathname.startsWith(itemPath + '/')
}

function Logo() {
  return (
    <Link to="/" className="flex items-center">
      <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-7 w-auto" />
    </Link>
  )
}

export function TenantLayout() {
  const location = useLocation()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { role: profileRole, displayName, landlordSurveyCompletedAt, loading: roleLoading } = useProfileRole(user)
  const [inviteBannerKey, setInviteBannerKey] = useState(0)

  useRedeemPendingLandlordInvite(user, profileRole, roleLoading)
  const inviteRestriction = useTenantInviteRestriction(user, profileRole, inviteBannerKey)

  useEffect(() => {
    function onRedeemed() {
      setInviteBannerKey((k) => k + 1)
    }
    window.addEventListener('rental-city-invite-redeemed', onRedeemed)
    return () => window.removeEventListener('rental-city-invite-redeemed', onRedeemed)
  }, [])

  useEffect(() => {
    if (roleLoading) return

    // Admins use <Navigate to="/admin" /> below — avoid navigate() here (double redirect + extra paint).

    // Landlord: redirect from / to wizard or matches
    if (profileRole === 'landlord') {
      if (location.pathname !== '/') return
      if (landlordSurveyCompletedAt) {
        navigate('/matches', { replace: true })
        return
      }
      if (!displayName) {
        navigate('/onboarding/profile', { replace: true })
        return
      }
      navigate('/onboarding/survey/intro', { replace: true })
      return
    }

    // Tenant: keep "/" pointing at matches; if survey isn't complete they'll see the prompt there.
    if (profileRole === 'tenant' && location.pathname === '/') {
      navigate('/matches', { replace: true })
    }
  }, [roleLoading, profileRole, displayName, landlordSurveyCompletedAt, location.pathname, navigate])

  const navItems = profileRole === 'landlord' ? landlordNavItems : tenantNavItems

  // Don't render role-dependent layout until we know role (prevents landlords seeing tenant nav/content)
  if (roleLoading || profileRole === null) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFD]">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (profileRole === 'admin') {
    return <Navigate to="/admin" replace />
  }

  // Launch sequencing: tenant side stays hidden behind the flag until there's
  // enough landlord inventory. Short-circuits before any tenant-only routes,
  // nav items, or data fetches below ever mount.
  if (profileRole === 'tenant' && !TENANT_SIDE_ENABLED) {
    return <TenantSideComingSoon />
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFD] text-gray-600" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200/60 sticky top-0 z-30 h-16 flex items-center shadow-sm">
        <div className="shrink-0 flex items-center px-6 h-full md:w-64 md:border-r border-gray-200/60">
          <Logo />
        </div>
        <div className="flex-1 flex justify-end items-center px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/notifications"
              className="p-2 rounded-full hover:bg-gray-50 text-gray-400 hover:text-[#0F1E3D] transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-5 h-5" />
            </Link>
            <UserMenu />
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="flex flex-1 min-h-0">
        {/* Fixed Left Sidebar */}
        <aside className="w-64 shrink-0 bg-white border-r border-gray-200/60 flex-col hidden md:flex">
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = !item.external && isNavActive(location.pathname, item.path)
              const className = `flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all font-semibold text-sm ${
                isActive
                  ? 'bg-[#EEF4FE] text-[#3A7AFE]'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-[#0F1E3D]'
              }`
              const content = (
                <>
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 2} />
                  {item.label}
                </>
              )
              return item.external ? (
                <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" className={className}>
                  {content}
                </a>
              ) : (
                <Link key={item.path} to={item.path} className={className}>
                  {content}
                </Link>
              )
            })}
          </nav>

          {/* Help / Bottom Section */}
          <div className="p-6 mt-auto">
            <div className="bg-[#F8FAFD] rounded-xl p-4 border border-gray-100">
              <h4 className="text-sm font-bold text-[#0F1E3D] mb-1">Need help?</h4>
              <p className="text-xs text-gray-500 mb-3">Our support team is here for you.</p>
              <Link to="/support" className="text-xs font-bold text-[#3A7AFE] hover:text-[#0F1E3D] transition-colors">
                Contact Support
              </Link>
            </div>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-auto min-w-0 bg-[#F8FAFD]">
          {/* Mobile nav (sidebar is hidden under md) */}
          <nav className="md:hidden flex items-center gap-1.5 overflow-x-auto bg-white border-b border-gray-200/60 px-4 py-2">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = !item.external && isNavActive(location.pathname, item.path)
              const className = `flex items-center gap-2 px-3 py-2 rounded-lg whitespace-nowrap text-sm font-semibold ${
                isActive ? 'bg-[#EEF4FE] text-[#3A7AFE]' : 'text-gray-500'
              }`
              const content = (
                <>
                  <Icon className="w-4 h-4" />
                  {item.label}
                </>
              )
              return item.external ? (
                <a key={item.path} href={item.path} target="_blank" rel="noopener noreferrer" className={className}>
                  {content}
                </a>
              ) : (
                <Link key={item.path} to={item.path} className={className}>
                  {content}
                </Link>
              )
            })}
          </nav>

          <div className="px-4 sm:px-6 lg:px-8 pt-6 pb-10">
            {profileRole === 'tenant' && inviteRestriction.active ? (
              <TenantInviteBanner restriction={inviteRestriction} />
            ) : null}
            <Outlet />
          </div>
        </main>
      </div>

      {/* Footer */}
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
