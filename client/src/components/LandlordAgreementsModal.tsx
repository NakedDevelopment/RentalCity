import { useCallback, useEffect, useState } from 'react'
import {
  createEquifaxAgreementSigningSession,
  createPlaidConsentSigningSession,
  type DocusignStatus,
  type EquifaxSubscriberDetails,
} from '../lib/docusignApi'

type AgreementKind = 'equifax' | 'plaid'

function CheckIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function AgreementRow({
  title,
  description,
  done,
  pendingApproval,
  onSign,
  signing,
}: {
  title: string
  description: string
  done: boolean
  pendingApproval?: boolean
  onSign: () => void
  signing: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-lg border border-gray-200 p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-sm text-gray-600">{description}</p>
        {pendingApproval && (
          <p className="mt-2 text-xs font-medium text-amber-700">Signed — pending Equifax's approval (~24h)</p>
        )}
      </div>
      {done ? (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700">
          <CheckIcon /> Signed
        </span>
      ) : (
        <button
          type="button"
          onClick={onSign}
          disabled={signing}
          className="shrink-0 rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {signing ? 'Opening…' : 'Sign'}
        </button>
      )}
    </div>
  )
}

export function LandlordAgreementsModal({
  open,
  status,
  accessToken,
  onSkip,
  onCompleted,
  required = false,
  onboarding = false,
}: {
  open: boolean
  status: DocusignStatus
  accessToken: string
  onSkip: () => void
  onCompleted: () => void
  required?: boolean
  onboarding?: boolean
}) {
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [signingType, setSigningType] = useState<AgreementKind | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showEquifaxForm, setShowEquifaxForm] = useState(false)
  const [businessDetails, setBusinessDetails] = useState<EquifaxSubscriberDetails>({
    businessName: '', phone: '', address: '',
  })

  useEffect(() => {
    if (open && !showEquifaxForm) {
      setBusinessDetails(status.equifaxSubscriberDetails ?? { businessName: '', phone: '', address: '' })
    }
  }, [open, status.equifaxSubscriberDetails, showEquifaxForm])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as { source?: string; type?: AgreementKind; completed?: boolean }
      if (data?.source !== 'docusign-return') return
      setSigningUrl(null)
      setSigningType(null)
       if (data.completed) {
         window.dispatchEvent(new Event('rental-city-docusign-completed'))
         onCompleted()
       }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onCompleted])

  const startSigning = useCallback(
    async (kind: AgreementKind, details?: EquifaxSubscriberDetails) => {
      setError(null)
      setSigningType(kind)
      try {
        const result =
          kind === 'equifax'
            ? await createEquifaxAgreementSigningSession(accessToken, details!)
            : await createPlaidConsentSigningSession(accessToken)
        setSigningUrl(result.signingUrl)
        setShowEquifaxForm(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not start signing session')
        setSigningType(null)
      }
    },
    [accessToken],
  )

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label="Sign required agreements"
    >
      <div className="w-full max-w-[560px] rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-medium text-gray-900">Sign required agreements</h2>
          {!required ? (
            <button
              type="button"
              onClick={onSkip}
              aria-label="Close"
              className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          ) : null}
        </div>

        {signingUrl ? (
          <div className="p-2 sm:p-3">
            <iframe
              title="Sign agreement"
              src={signingUrl}
              className="h-[70vh] w-full rounded-lg border border-gray-200"
            />
          </div>
        ) : (
          <div className="space-y-4 px-5 py-5">
            <p className="text-sm text-gray-600">
              {status.equifaxNeedsResign
                ? 'Equifax agreement terms have been updated — click to sign the updated agreement.'
                : onboarding
                  ? 'Before you add your first property, please sign the two agreements required to access tenant screening information.'
                  : 'Before you can view tenant financial data, credit reports, or background checks, you need to sign two required agreements.'}
            </p>

            {showEquifaxForm ? (
              <form
                className="space-y-3 rounded-lg border border-gray-200 p-4"
                onSubmit={(event) => {
                  event.preventDefault()
                  void startSigning('equifax', businessDetails)
                }}
              >
                <h3 className="text-sm font-semibold text-gray-900">Updated Equifax agreement — subscriber details</h3>
                <p className="text-xs text-gray-600">Confirm the business information that will appear on your agreement. Do not use a rental property address unless it is also your business mailing address.</p>
                {([
                  ['businessName', 'Business / subscriber name', 'Your legal business name'],
                  ['phone', 'Business phone', '(555) 555-5555'],
                  ['address', 'Full business mailing address', 'Street address, city, state, ZIP'],
                ] as const).map(([field, label, placeholder]) => (
                  <label key={field} className="block text-sm font-medium text-gray-700">
                    {label}
                    <input
                      required
                      type={field === 'phone' ? 'tel' : 'text'}
                      value={businessDetails[field]}
                      onChange={(event) => setBusinessDetails((current) => ({ ...current, [field]: event.target.value }))}
                      placeholder={placeholder}
                      maxLength={field === 'address' ? 85 : field === 'phone' ? 25 : 60}
                      className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
                    />
                  </label>
                ))}
                <div className="flex items-center gap-3">
                  <button type="submit" disabled={signingType === 'equifax'} className="rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                    {signingType === 'equifax' ? 'Opening…' : 'Continue to sign'}
                  </button>
                  <button type="button" onClick={() => setShowEquifaxForm(false)} className="text-sm text-gray-600 underline">Back</button>
                </div>
              </form>
            ) : <AgreementRow
              title="Equifax Broker Subscriber Agreement"
              description={
                status.equifaxNeedsResign
                  ? 'Updated Equifax agreement required. Sign the corrected version, then wait for Equifax to approve it before running new checks.'
                  : "Required to run credit checks. After signing, Equifax reviews and approves access (about 24 hours)."
              }
              done={status.equifaxSigned}
              pendingApproval={status.equifaxSigned && !status.equifaxApproved}
              onSign={() => { setError(null); setShowEquifaxForm(true) }}
              signing={signingType === 'equifax'}
            />}

            <AgreementRow
              title="Plaid End Client Consent"
              description="Required to view a tenant's bank verification data. Takes effect immediately after signing."
              done={status.plaidSigned}
              onSign={() => void startSigning('plaid')}
              signing={signingType === 'plaid'}
            />

            {error && <p className="text-sm text-red-600">{error}</p>}

            {required ? (
              <p className="text-center text-sm text-gray-500">
                Both agreements must be signed before you can continue to your first property.
              </p>
            ) : (
              <p className="text-center text-sm text-gray-500">
                <button type="button" onClick={onSkip} className="underline hover:text-gray-700">
                  No, I&apos;ll do this later
                </button>{' '}
                — you won&apos;t be able to view tenant details until both are signed
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
