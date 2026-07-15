import { Link, Navigate, useParams } from 'react-router-dom'
import { PRIVACY_HEADING, PrivacyContent, TERMS_HEADING, TermsContent } from '../legal'

const TABS = ['terms', 'privacy'] as const
type LegalTab = (typeof TABS)[number]

export function LegalPage() {
  const { tab = 'terms' } = useParams<{ tab?: string }>()

  if (tab !== 'terms' && tab !== 'privacy') {
    return <Navigate to="/account/settings/legal/terms" replace />
  }

  const activeTab = tab as LegalTab

  return (
    <div className="py-6">
      <div className="mb-8 flex flex-wrap gap-4">
        <Link
          to="/account/settings/legal/terms"
          className={`inline-flex min-w-[184px] items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'terms'
              ? 'gradient-primary text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Terms of Service
        </Link>
        <Link
          to="/account/settings/legal/privacy"
          className={`inline-flex min-w-[184px] items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-colors ${
            activeTab === 'privacy'
              ? 'gradient-primary text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Privacy Policy
        </Link>
      </div>

      <h2 className="mb-4 text-[2rem] font-medium text-gray-900">
        {activeTab === 'terms' ? TERMS_HEADING : PRIVACY_HEADING}
      </h2>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        {activeTab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </section>
    </div>
  )
}
