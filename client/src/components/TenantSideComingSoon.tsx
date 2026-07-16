import { supabase } from '../lib/supabase'

/** Shown in place of the full tenant experience while VITE_TENANT_SIDE_ENABLED is false. */
export function TenantSideComingSoon() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8FAFD] px-4 text-center">
      <img src="/brand/rental-city-wordmark-gradient.svg" alt="Rental City" className="h-8 w-auto mb-6" />
      <h1 className="text-xl font-bold text-gray-900 mb-2">Tenant access is launching soon</h1>
      <p className="max-w-sm text-sm text-gray-600 mb-6">
        We're onboarding landlords first to build up property listings. Your account is saved and
        we'll let you know as soon as tenant matching opens up.
      </p>
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="text-sm font-medium text-[#3A7AFE] hover:text-[#0F1E3D] transition-colors"
      >
        Sign out
      </button>
    </div>
  )
}
