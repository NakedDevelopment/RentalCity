import termlyPrivacyHtml from './privacy-policy-termly.html?raw'
import termsSections from './terms-content.json'

export const TERMS_HEADING = 'Rental City Terms of Service'
export const PRIVACY_HEADING = 'Rental City Privacy Policy'

export function TermsContent() {
  return (
    <div className="space-y-10">
      {(termsSections as { title: string; body: string }[]).map((section) => (
        <div key={section.title}>
          <h3 className="text-[1.35rem] font-medium text-gray-900">{section.title}</h3>
          <p className="mt-3 max-w-4xl whitespace-pre-line text-base leading-8 text-gray-600">
            {section.body}
          </p>
        </div>
      ))}
    </div>
  )
}

export function PrivacyContent() {
  return (
    <div
      className="termly-policy max-w-4xl overflow-x-hidden break-words"
      // Trusted static legal document exported from Termly by the site owner.
      dangerouslySetInnerHTML={{ __html: termlyPrivacyHtml }}
    />
  )
}
