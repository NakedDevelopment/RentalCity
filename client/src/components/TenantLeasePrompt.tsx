import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  createLeaseSigningSession,
  downloadLeaseCopy,
  getMyLeases,
  type LeaseView,
} from '../lib/leaseApi'

export function TenantLeasePrompt() {
  const [action, setAction] = useState<LeaseView | null>(null)
  const [completed, setCompleted] = useState<LeaseView[]>([])
  const [signingUrl, setSigningUrl] = useState<string | null>(null)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession()
    const accessToken = data.session?.access_token
    if (!accessToken) return
    setToken(accessToken)
    try {
      const mine = await getMyLeases(accessToken)
      setAction(mine.action)
      setCompleted(mine.completed)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your lease')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return
      const data = event.data as { source?: string; type?: string; completed?: boolean }
      if (data?.source !== 'docusign-return' || data.type !== 'lease') return
      setSigningUrl(null)
      void refresh()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [refresh])

  async function openSigning() {
    if (!action || opening) return
    setOpening(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const accessToken = data.session?.access_token
      if (!accessToken) throw new Error('Sign in again to sign the lease.')
      const session = await createLeaseSigningSession(accessToken, action.id)
      setSigningUrl(session.signingUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open the signing session')
    } finally {
      setOpening(false)
    }
  }

  async function downloadSigned(leaseId: string) {
    setError(null)
    try {
      const accessToken = token ?? (await supabase.auth.getSession()).data.session?.access_token
      if (!accessToken) throw new Error('Sign in again to download the lease.')
      await downloadLeaseCopy(accessToken, leaseId, 'signed')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not download the lease')
    }
  }

  const signed = completed[0]
  if (!action && !signed && !error) return null

  return (
    <>
      {action ? (
        <div
          role="alert"
          className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>
            <span className="font-semibold">Lease ready to sign.</span>{' '}
            {action.propertyLabel ? `${action.propertyLabel} is waiting for your signature.` : 'Your landlord sent a lease for you to sign.'}
          </p>
          <button
            type="button"
            onClick={() => void openSigning()}
            disabled={opening}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {opening ? 'Opening…' : 'Sign lease'}
          </button>
        </div>
      ) : null}
      {signed ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 sm:flex-row sm:items-center sm:justify-between">
          <p>
            <span className="font-semibold text-gray-900">Signed lease.</span>{' '}
            {signed.propertyLabel ? `Your lease for ${signed.propertyLabel} is ready.` : 'Your signed lease is ready.'}
          </p>
          <button
            type="button"
            onClick={() => void downloadSigned(signed.id)}
            className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Download signed lease
          </button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mb-4 text-sm text-red-600">{error}</p> : null}

      {signingUrl ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8" role="dialog" aria-modal="true" aria-label="Sign lease">
          <div className="w-full max-w-3xl rounded-2xl bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-medium text-gray-900">Sign your lease</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setSigningUrl(null)}
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="space-y-3 p-3">
              <iframe title="Sign lease" src={signingUrl} className="h-[70vh] w-full rounded-lg border border-gray-200" />
              <button
                type="button"
                onClick={() => { setSigningUrl(null); void refresh() }}
                className="inline-flex min-h-11 items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white"
              >
                I&apos;ve finished signing — check status
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
