import { useEffect, useState } from 'react'
import { useAuth } from '../lib/useAuth'
import { fetchSiteSettingsMerged } from '../lib/siteSettings'
import { supabase } from '../lib/supabase'

export function SupportPage() {
  const { user } = useAuth()
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [responseLine, setResponseLine] = useState('')
  const [hoursLine, setHoursLine] = useState('')
  const [submitSuccessMessage, setSubmitSuccessMessage] = useState('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const s = await fetchSiteSettingsMerged(supabase)
      if (cancelled) return
      setResponseLine(s.support_response_time_line)
      setHoursLine(s.support_hours_line)
      setSubmitSuccessMessage(s.support_submit_success_message)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSuccess(null)

    if (!user) {
      setError('You must be signed in to submit a support request.')
      return
    }

    if (!subject.trim()) {
      setError('Please enter a subject.')
      return
    }

    if (message.trim().length < 10) {
      setError('Please provide at least 10 characters in your message.')
      return
    }

    setSubmitting(true)

    const { error: insertError } = await supabase.from('support_requests').insert({
      user_id: user.id,
      subject: subject.trim(),
      message: message.trim(),
    })

    setSubmitting(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setSubject('')
    setMessage('')
    setSuccess(submitSuccessMessage || 'Support request submitted. Our team will follow up within 24 hours.')
  }

  return (
    <div className="py-6 px-4">
      <div className="space-y-5">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18.364 5.636A9 9 0 115.636 18.364M9 10h.01M15 10h.01M9 15h6"
              />
            </svg>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-gray-900">Contact Support</h2>
              <p className="mt-1 text-sm text-gray-600">
                Your message is saved as a support ticket for our team. You&apos;ll see confirmation below after you send.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-5">
            <div>
              <label htmlFor="support-subject" className="mb-2 block text-sm font-medium text-gray-700">
                Subject
              </label>
              <input
                id="support-subject"
                type="text"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                placeholder="Brief description of your issue"
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="support-message" className="mb-2 block text-sm font-medium text-gray-700">
                Message
              </label>
              <textarea
                id="support-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Please provide detailed information about your issue or question. Include any relevant details that might help us assist you better."
                rows={6}
                className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm leading-7 text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
              <p className="mt-2 text-xs text-gray-500">Minimum 10 characters required</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-medium text-white hover:bg-primary/90"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l14-7-4 14-3-5-7-2z" />
              </svg>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}
            {success ? <p className="text-sm text-emerald-600">{success}</p> : null}
          </form>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h2 className="text-[1.35rem] font-medium text-gray-900">Response Time</h2>
              <p className="mt-3 text-sm text-gray-600">{responseLine || 'We typically respond within 24 hours'}</p>
              <p className="mt-1 text-sm text-gray-500">{hoursLine || 'Monday - Friday, 9 AM - 6 PM EST'}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
