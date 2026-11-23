import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

const fieldClass =
  'w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none'

type Props = { propertyId: string }

export function TourRequestButton({ propertyId }: Props) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const sending = useRef(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationSent, setConfirmationSent] = useState<boolean | null>(null)

  useEffect(() => {
    if (!open || !user) return
    let cancelled = false
    setEmail(user.email ?? '')
    void supabase
      .from('profiles')
      .select('display_name, phone')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        const profile = data as { display_name?: string | null; phone?: string | null } | null
        setName((current) => current || profile?.display_name?.trim() || '')
        setPhone((current) => current || profile?.phone?.trim() || '')
      })
    return () => {
      cancelled = true
    }
  }, [open, user])

  function close() {
    if (submitting) return
    setOpen(false)
    setError(null)
    setConfirmationSent(null)
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (sending.current) return
    setError(null)
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }
    if (!message.trim()) {
      setError('Message is required.')
      return
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setError('You must be signed in to request a tour.')
      return
    }

    sending.current = true
    setSubmitting(true)
    try {
      const res = await fetch('/api/listing-tour-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          propertyId,
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          preferredTime: preferredTime.trim(),
          message: message.trim(),
        }),
      })
      const payload = (await res.json().catch(() => null)) as { error?: string; confirmationSent?: boolean } | null
      if (!res.ok) {
        setError(payload?.error || "We couldn't send your request. Please try again.")
        return
      }
      setConfirmationSent(Boolean(payload?.confirmationSent))
    } catch {
      setError("We couldn't send your request. Please try again.")
    } finally {
      sending.current = false
      setSubmitting(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null)
          setConfirmationSent(null)
          setOpen(true)
        }}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
      >
        Request a tour
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tour-request-title"
          >
            {confirmationSent !== null ? (
              <div className="px-6 py-8 text-center" data-testid="tour-request-confirmation">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 id="tour-request-title" className="mt-5 text-[1.6rem] font-medium text-gray-900">
                  Request sent
                </h2>
                <p className="mt-4 text-sm leading-7 text-gray-600">
                  The landlord has your tour request
                  {confirmationSent ? `, and we emailed a confirmation to ${email.trim()}.` : '.'}
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-6 inline-flex min-w-[120px] items-center justify-center rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} data-testid="tour-request-form">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h2 id="tour-request-title" className="text-[1.6rem] font-medium text-gray-900">
                    Request a tour
                  </h2>
                </div>
                <div className="space-y-4 px-6 py-4">
                  <label className="block text-sm text-gray-500" htmlFor="tour-name">
                    Name
                    <input id="tour-name" value={name} onChange={(event) => setName(event.target.value)} className={`mt-2 ${fieldClass}`} required />
                  </label>
                  <label className="block text-sm text-gray-500" htmlFor="tour-email">
                    Email
                    <input id="tour-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={`mt-2 ${fieldClass}`} required />
                  </label>
                  <label className="block text-sm text-gray-500" htmlFor="tour-phone">
                    Phone <span className="text-gray-400">(optional)</span>
                    <input id="tour-phone" type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-sm text-gray-500" htmlFor="tour-when">
                    Preferred date and time <span className="text-gray-400">(optional)</span>
                    <input id="tour-when" type="datetime-local" value={preferredTime} onChange={(event) => setPreferredTime(event.target.value)} className={`mt-2 ${fieldClass}`} />
                  </label>
                  <label className="block text-sm text-gray-500" htmlFor="tour-message">
                    Message
                    <textarea id="tour-message" value={message} onChange={(event) => setMessage(event.target.value)} rows={4} className={`mt-2 ${fieldClass}`} required />
                  </label>
                  {error ? <p className="text-sm text-red-600">{error}</p> : null}
                </div>
                <div className="grid grid-cols-2 gap-3 px-6 pb-6">
                  <button
                    type="button"
                    onClick={close}
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {submitting ? 'Sending...' : 'Request a tour'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}
