import { supabase } from './supabase'

/**
 * Fire-and-forget: asks the server to email the support team about a newly
 * submitted support request. The ticket is already stored in Supabase, so
 * failures here are logged but never surfaced to the user.
 */
export async function notifySupportTeam(requestId: string | undefined): Promise<void> {
  if (!requestId) return
  try {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) return
    await fetch('/api/support/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ requestId }),
    })
  } catch (err) {
    console.warn('Support notification call failed:', err)
  }
}
