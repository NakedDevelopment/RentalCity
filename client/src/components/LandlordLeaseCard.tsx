import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { downloadLeaseCopy, getLandlordLease, sendLeasePdf, type LeaseView } from '../lib/leaseApi'

const PDF_LIMIT = 8 * 1024 * 1024

function statusClass(status: string | null): string {
  if (status === 'completed') return 'bg-green-50 text-green-700'
  if (status === 'delivered') return 'bg-blue-50 text-blue-700'
  if (status === 'declined') return 'bg-red-50 text-red-700'
  return 'bg-gray-100 text-gray-700'
}

export function LandlordLeaseCard({
  tenantId,
  propertyId,
  applicationId,
}: {
  tenantId: string
  propertyId: string
  applicationId: string | null
}) {
  const [lease, setLease] = useState<LeaseView | null>(null)
  const [loading, setLoading] = useState(true)
  const [file, setFile] = useState<File | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(false)
  const [justSent, setJustSent] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) {
        if (!cancelled) {
          setLoading(false)
          setError('Sign in again to send a lease.')
        }
        return
      }
      try {
        const current = await getLandlordLease(token, propertyId, tenantId)
        if (!cancelled) setLease(current)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the lease')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [propertyId, tenantId])

  function showError(message: string) {
    setError(message)
    setShake(true)
    window.setTimeout(() => setShake(false), 400)
  }

  async function onSend() {
    if (!file || sending) return
    const typeOk = !file.type || file.type === 'application/pdf' || file.type === 'application/octet-stream'
    if (!typeOk || !file.name.toLowerCase().endsWith('.pdf')) {
      showError('Upload a PDF file.')
      return
    }
    if (file.size > PDF_LIMIT) {
      showError('That PDF is too large. Upload a file under 8 MB.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in again to send a lease.')
      const saved = await sendLeasePdf(token, file, { propertyId, tenantId, applicationId })
      setLease(saved)
      setFile(null)
      setJustSent(true)
      window.setTimeout(() => setJustSent(false), 250)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not send the lease')
    } finally {
      setSending(false)
    }
  }

  async function onDownload(copy: 'original' | 'signed') {
    if (!lease) return
    setError(null)
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in again to download the lease.')
      await downloadLeaseCopy(token, lease.id, copy)
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not download the lease')
    }
  }

  const label = lease?.statusLabel ?? 'Not sent'
  const replacingSigned = lease?.status === 'completed'

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold tracking-tight text-gray-900">Lease</h2>
        <span className={`inline-flex min-h-8 items-center rounded-full px-3 py-1 text-xs font-medium transition duration-200 ease-out ${statusClass(lease?.status ?? null)} ${justSent ? 'scale-105' : 'scale-100'}`}>
          {loading ? 'Loading…' : label}
        </span>
      </div>
      <p className="text-sm text-gray-600">
        {lease?.propertyLabel
          ? `Upload your lease PDF for ${lease.propertyLabel}. The tenant signs it in Rental City.`
          : 'Upload your lease PDF for this tenant and property. The tenant signs it in Rental City.'}
      </p>
      {replacingSigned ? (
        <p className="mt-3 text-sm text-gray-600">
          A signed copy is already saved. Sending a new PDF starts another signature request and does not change the signed file.
        </p>
      ) : null}
      {lease && (lease.status === 'sent' || lease.status === 'delivered') ? (
        <p className="mt-3 text-sm text-gray-600">
          Waiting for the tenant. Uploading a different PDF replaces this unsigned request.
        </p>
      ) : null}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Choose PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null)
              setError(null)
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => void onSend()}
          disabled={!file || sending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg btn-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? 'Sending…' : 'Send lease'}
        </button>
        {file ? <span className="min-w-0 truncate text-sm text-gray-500">{file.name}</span> : null}
      </div>

      {lease && (lease.hasOriginal || lease.hasSigned) ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {lease.hasOriginal ? (
            <button
              type="button"
              onClick={() => void onDownload('original')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download original
            </button>
          ) : null}
          {lease.hasSigned ? (
            <button
              type="button"
              onClick={() => void onDownload('signed')}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Download signed lease
            </button>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className={`mt-3 text-sm text-red-600 ${shake ? 'lease-shake' : ''}`}>
          {error}
        </p>
      ) : null}
    </section>
  )
}
