import { Link } from 'react-router-dom'
import { PRIVACY_HEADING, PrivacyContent, TERMS_HEADING, TermsContent } from '../legal'

type LegalTab = 'terms' | 'privacy'

export function PublicLegalPage({ tab }: { tab: LegalTab }) {
  return (
    <div className="mx-auto w-full max-w-6xl py-6 px-4">
      <div className="mb-8 flex flex-wrap gap-4">
        <Link
          to="/terms"
          className={`inline-flex min-w-[184px] items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-colors ${
            tab === 'terms'
              ? 'gradient-primary text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Terms of Service
        </Link>
        <Link
          to="/privacy"
          className={`inline-flex min-w-[184px] items-center justify-center rounded-full px-6 py-3 text-sm font-medium transition-colors ${
            tab === 'privacy'
              ? 'gradient-primary text-white'
              : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
          }`}
        >
          Privacy Policy
        </Link>
      </div>

      <h2 className="mb-4 text-[2rem] font-medium text-gray-900">
        {tab === 'terms' ? TERMS_HEADING : PRIVACY_HEADING}
      </h2>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        {tab === 'terms' ? <TermsContent /> : <PrivacyContent />}
      </section>
    </div>
  )
}
