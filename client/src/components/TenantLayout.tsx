import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { useRedeemPendingLandlordInvite } from '../lib/useRedeemPendingLandlordInvite'
import { useTenantInviteRestriction } from '../lib/useTenantInviteRestriction'
import { TenantInviteBanner } from './TenantInviteBanner'
import { UserMenu } from './UserMenu'

const tenantNavItems = [
  { path: '/matches', label: 'Matches', icon: 'home' },
  { path: '/account', label: 'My Profile', icon: 'person' },
  { path: '/messages', label: 'Inbox', icon: 'envelope' },
  { path: '/account/settings', label: 'Settings', icon: 'settings' },
] as const

const landlordNavItems = [
  { path: '/matches', label: 'Matches', icon: 'home' },
  { path: '/properties', label: 'Properties', icon: 'building' },
  { path: '/messages', label: 'Inbox', icon: 'envelope' },
  { path: '/account', label: 'My Profile', icon: 'person' },
  { path: '/account/settings', label: 'Settings', icon: 'settings' },
] as const

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

function NavIcon({ name }: { name: string }) {
  const icons: Record<string, React.ReactNode> = {
    search: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
    home: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
    document: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    envelope: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    person: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    settings: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    building: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V7a2 2 0 012-2h10a2 2 0 012 2v14M9 9h.01M9 12h.01M9 15h.01M12 9h.01M12 12h.01M12 15h.01M15 9h.01M15 12h.01M15 15h.01" />
      </svg>
    ),
  }
  return icons[name] ?? null
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (profileRole === 'admin') {
    return <Navigate to="/admin" replace />
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <div className="flex flex-1 min-h-0 flex-col w-full max-w-[1600px] mx-auto pl-2 pr-4">
        <header className="relative z-10 bg-white border-b shrink-0 -mx-4 pl-2 pr-4">
          <div className="flex items-center">
            <Logo />
            <div className="w-56 shrink-0 mr-4" aria-hidden />
            <div className="flex-1 min-w-0 flex justify-end">
              <nav className="flex items-center gap-2 py-4">
                <Link to="/notifications" className="p-2 rounded-lg hover:bg-gray-100">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </Link>
                <UserMenu />
              </nav>
            </div>
          </div>
        </header>

        <div className="flex flex-1 min-h-0 -ml-4 -mr-4">
          <aside className="relative z-10 w-56 shrink-0 mr-4 bg-white text-gray-900 flex flex-col border-r border-gray-100">
            <nav className="flex-1 p-4 space-y-1 pt-4">
              {navItems.map((item) => {
                const isActive = isNavActive(location.pathname, item.path)
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      isActive ? 'gradient-primary text-white' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    <NavIcon name={item.icon} />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </aside>

          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 overflow-auto min-w-0">
              <div className="w-full pt-4 pb-6 shrink-0">
                {profileRole === 'tenant' && inviteRestriction.active ? (
                  <TenantInviteBanner restriction={inviteRestriction} />
                ) : null}
                <Outlet />
              </div>
            </main>
          </div>
        </div>

        <footer className="relative z-10 bg-white border-t py-6 shrink-0 -mx-4 pl-2 pr-4">
          <div className="flex items-center">
            <span className="text-sm text-gray-600">© 2026 Rental City. All rights reserved.</span>
            <div className="w-56 shrink-0 mr-4" aria-hidden />
            <div className="flex-1 min-w-0 flex justify-end">
              <nav className="flex items-center gap-6 text-sm text-gray-600">
                <Link to="/about" className="hover:text-gray-900">About</Link>
                <Link to="/privacy" className="hover:text-gray-900">Privacy</Link>
                <Link to="/terms" className="hover:text-gray-900">Terms</Link>
                <Link to="/support" className="hover:text-gray-900">Support</Link>
              </nav>
            </div>
          </div>
        </footer>
      </div>
    </div>
  )
}
