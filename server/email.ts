// Minimal transactional-email helper for the Rental Value Report lead magnet.
//
// Uses the MailerSend REST API (https://developers.mailersend.com). It is
// intentionally best-effort: if no transport is configured (MAILERSEND_API_KEY /
// FROM_EMAIL missing) it logs a warning and returns false instead of throwing,
// so the /api/estimate response is never blocked on email delivery.

const MAILERSEND_API_KEY = process.env.MAILERSEND_API_KEY || ''
const FROM_EMAIL = process.env.FROM_EMAIL || process.env.MAILERSEND_FROM_EMAIL || ''
const FROM_NAME = process.env.FROM_NAME || 'Rental City'

export function isEmailConfigured(): boolean {
  return Boolean(MAILERSEND_API_KEY && FROM_EMAIL)
}

export interface SendEmailArgs {
  to: string
  subject: string
  html: string
  text?: string
}

// Returns true if the email was accepted by the provider, false otherwise.
// Never throws.
export async function sendReportEmail({ to, subject, html, text }: SendEmailArgs): Promise<boolean> {
  if (!isEmailConfigured()) {
    console.warn(
      'Email not sent: MAILERSEND_API_KEY / FROM_EMAIL not configured. Skipping report email to',
      to,
    )
    return false
  }
  if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    console.warn('Email not sent: invalid recipient address', to)
    return false
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${MAILERSEND_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        from: { email: FROM_EMAIL, name: FROM_NAME },
        to: [{ email: to }],
        subject,
        html,
        text: text || stripHtml(html),
      }),
      signal: controller.signal,
    })
    if (!res.ok && res.status !== 202) {
      const detail = await res.text().catch(() => '')
      console.error('MailerSend send failed:', res.status, detail.slice(0, 300))
      return false
    }
    return true
  } catch (err) {
    console.error('MailerSend send error:', err instanceof Error ? err.message : String(err))
    return false
  } finally {
    clearTimeout(timeout)
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
