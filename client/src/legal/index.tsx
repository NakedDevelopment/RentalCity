import termlyPrivacyHtml from './privacy-policy-termly.html?raw'
import termlyTermsHtml from './terms-termly.html?raw'

export const TERMS_HEADING = 'Rental City Terms of Service'
export const PRIVACY_HEADING = 'Rental City Privacy Policy'

// Trusted static legal documents exported from Termly by the site owner.
export function TermsContent() {
  return (
    <div
      className="termly-policy max-w-4xl overflow-x-hidden break-words"
      dangerouslySetInnerHTML={{ __html: termlyTermsHtml }}
    />
  )
}

export function PrivacyContent() {
  return (
    <div
      className="termly-policy max-w-4xl overflow-x-hidden break-words"
      dangerouslySetInnerHTML={{ __html: termlyPrivacyHtml }}
    />
  )
}
