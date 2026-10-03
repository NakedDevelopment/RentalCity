import { createClient } from '@supabase/supabase-js'
import { createRecoverySessionTracker } from '../../../shared/recoverySession'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.warn('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY – using placeholders. Add .env.local with real values for auth.')
}

// Use placeholders when env vars are missing so the app can boot locally
const supabaseUrl = url || 'https://placeholder.supabase.co'
const supabaseAnonKey = anonKey || 'placeholder-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Subscribe at SDK creation time, before React's auth loading gate can consume
// the URL fragment and delay mounting RecoveryLinkHandler/ResetPasswordPage.
export const recoverySession = createRecoverySessionTracker()
supabase.auth.onAuthStateChange((event, session) => {
  recoverySession.record(event, session)
})
