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

// ---------------------------------------------------------------------------
// Landlord lifecycle emails (sent once each, personalized with first name).
// ---------------------------------------------------------------------------

export type LandlordLifecycleKind = 'all_uploaded' | 'partial_upload' | 'upload_reminder'

function lifecycleLayout(firstName: string, bodyHtml: string, ctaLabel: string, ctaUrl: string): string {
  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background-color:#0F1E3D;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">Rental City</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">Hi ${firstName},</p>
            ${bodyHtml}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
              <tr><td style="border-radius:8px;background-color:#3A7AFE;">
                <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">${ctaLabel}</a>
              </td></tr>
            </table>
            <p style="margin:24px 0 0;font-size:13px;color:#6b7280;">— The Rental City Team</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`
}

export function buildLandlordLifecycleEmail(
  kind: LandlordLifecycleKind,
  params: { firstName: string; appUrl: string },
): { subject: string; html: string } {
  const { firstName, appUrl } = params
  if (kind === 'all_uploaded') {
    return {
      subject: 'Your properties are live on Rental City',
      html: lifecycleLayout(
        firstName,
        `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#374151;">Thanks so much for signing up — we've got all your properties listed and they're live on Rental City.</p>
         <p style="margin:0;font-size:15px;line-height:24px;color:#374151;">We're onboarding quality tenants right now, and we'll let you know the moment we find the right tenant match for your properties. Sit tight — the matches are coming.</p>`,
        'View My Properties',
        `${appUrl}/properties`,
      ),
    }
  }
  if (kind === 'partial_upload') {
    return {
      subject: "Don't forget the rest of your properties",
      html: lifecycleLayout(
        firstName,
        `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#374151;">Thanks so much for signing up — your first listing is live on Rental City!</p>
         <p style="margin:0;font-size:15px;line-height:24px;color:#374151;">It looks like you have more properties to add. Don't forget to come back and upload the rest — the more properties you list, the more tenant matches we can find for you.</p>`,
        'Upload Another Property',
        `${appUrl}/onboarding/property/basic-info`,
      ),
    }
  }
  return {
    subject: 'Ready to list your first property?',
    html: lifecycleLayout(
      firstName,
      `<p style="margin:0 0 12px;font-size:15px;line-height:24px;color:#374151;">Thanks for signing up for Rental City!</p>
       <p style="margin:0;font-size:15px;line-height:24px;color:#374151;">Don't forget to upload your properties so we can start finding the perfect tenant match for you. It only takes a few minutes to get your first listing live.</p>`,
      'Upload My Properties',
      `${appUrl}/onboarding/property/intro`,
    ),
  }
}

export function buildSupportNotificationEmail(params: {
  subject: string
  message: string
  senderName: string
  senderEmail: string
  appUrl: string
}): { subject: string; html: string } {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  return {
    subject: `New support request: ${params.subject}`,
    html: `<!doctype html>
<html>
  <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;">
          <tr><td style="background-color:#0F1E3D;padding:20px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:bold;">Rental City — Support</span>
          </td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:16px;color:#111827;">A new support request was submitted.</p>
            <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>From:</strong> ${esc(params.senderName)} (${esc(params.senderEmail)})</p>
            <p style="margin:0 0 16px;font-size:14px;color:#374151;"><strong>Subject:</strong> ${esc(params.subject)}</p>
            <div style="border-left:3px solid #3A7AFE;padding:8px 16px;background-color:#f9fafb;">
              <p style="margin:0;font-size:14px;line-height:22px;color:#374151;white-space:pre-wrap;">${esc(params.message)}</p>
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 8px;">
              <tr><td style="border-radius:8px;background-color:#3A7AFE;">
                <a href="${params.appUrl}/admin/issues" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:bold;color:#ffffff;text-decoration:none;">Open in Admin Panel</a>
              </td></tr>
            </table>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
