import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { User } from '@/types'
import { supabase } from './supabase'

interface GoogleProfile {
  name?: string
  full_name?: string
  avatar_url?: string
  picture?: string
}

function toUser(session: Session | null): User | null {
  const account = session?.user
  if (!account) return null
  const meta = (account.user_metadata ?? null) as GoogleProfile | null
  const name = meta?.name?.trim() || meta?.full_name?.trim() || account.email?.split('@')[0] || 'User'
  return {
    id: account.id,
    email: account.email ?? '',
    name,
    avatarUrl: meta?.avatar_url ?? meta?.picture ?? null,
  }
}

interface AuthValue {
  user: User | null
  loading: boolean
  signInWithGoogle: (redirectPath?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

/**
 * Wraps Supabase Auth: session restore + change listener feed `user`/`loading`,
 * and signInWithGoogle/signOut proxy straight to supabase-js (which owns access +
 * refresh token storage/rotation — see CLAUDE.md's Supabase pivot notes). Google
 * OAuth is the only sign-in method — see CLAUDE.md for why email/password was dropped.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setUser(toUser(data.session))
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toUser(session))
      setLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const signInWithGoogle: AuthValue['signInWithGoogle'] = async (redirectPath) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${redirectPath ?? '/dashboard'}` },
    })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

// useAuth is colocated with AuthProvider/AuthContext (the standard provider+hook
// pattern) rather than split into its own file, hence the Fast Refresh trade-off here.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
