import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = {
  user: User | null
  loading: boolean
}

const AuthContext = createContext<AuthState | null>(null)

/**
 * Single auth session for the whole app. Without this, every `useAuth()` call had its own
 * `useState`, so e.g. AdminLayout mounted with `user === null` until its own `getSession`
 * finished — triggering `<Navigate to="/login" />` and a flicker/redirect loop with the standard app routes.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // `getSession()` above already applied the initial session; this event duplicates it and
      // can reorder updates in a way that flashes null user across mounted layouts.
      if (event === 'INITIAL_SESSION') return
      setUser(session?.user ?? null)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({ user, loading }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
