import { supabase } from './supabase'

export type AdminDirectoryUser = {
  id: string
  email: string
  role: string
  display_name: string | null
  is_suspended: boolean
  phone: string | null
  created_at: string
  avatar_url: string | null
  last_sign_in_at: string | null
  equifax_approved_at: string | null
  equifax_pending_since: string | null
}

export async function fetchAdminDirectory(): Promise<AdminDirectoryUser[]> {
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not signed in')
  const res = await fetch('/api/admin/directory', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(j.error ?? res.statusText)
  }
  const j = (await res.json()) as { users: AdminDirectoryUser[] }
  return j.users ?? []
}
