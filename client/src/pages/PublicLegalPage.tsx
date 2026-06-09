import { Link } from 'react-router-dom'

const CONTENT = {
  terms: {
    tabLabel: 'Terms of Service',
    heading: 'Rental City Terms of Service',
    sections: [
      {
        title: 'Accepting The Terms',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam sit amet ex mattis, lobortis ante vitae, bibendum ex. Vestibulum feugiat mi eu tincidunt congue. Nam viverra. Lorem ipsum dolor',
      },
      {
        title: 'Using Rental City App',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam sit amet ex mattis, lobortis ante vitae, bibendum ex. Vestibulum feugiat mi eu tincidunt congue. Nam viverra. Lorem ipsum dolor',
      },
    ],
  },
  privacy: {
    tabLabel: 'Privacy Policy',
    heading: 'Rental City Privacy Policy',
    sections: [
      {
        title: 'Accepting The Terms',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam sit amet ex mattis, lobortis ante vitae, bibendum ex. Vestibulum feugiat mi eu tincidunt congue. Nam viverra. Lorem ipsum dolor',
      },
      {
        title: 'Using Rental City App',
        body: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam sit amet ex mattis, lobortis ante vitae, bibendum ex. Vestibulum feugiat mi eu tincidunt congue. Nam viverra. Lorem ipsum dolor',
      },
    ],
  },
} as const

type LegalTab = keyof typeof CONTENT

export function PublicLegalPage({ tab }: { tab: LegalTab }) {
  const content = CONTENT[tab]

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

      <h2 className="mb-4 text-[2rem] font-medium text-gray-900">{content.heading}</h2>

      <section className="rounded-xl border border-gray-200 bg-white px-5 py-4">
        <div className="space-y-10">
          {content.sections.map((section) => (
            <div key={section.title}>
              <h3 className="text-[1.35rem] font-medium text-gray-900">{section.title}</h3>
              <p className="mt-3 max-w-4xl text-base leading-8 text-gray-600">{section.body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
