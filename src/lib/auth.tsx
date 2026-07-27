import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

type AuthState = {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Returns true if the user is signed in immediately; false if email confirmation is required. */
  signUpWithPassword: (email: string, password: string) => Promise<boolean>
  signInWithEmail: (email: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setLoading(false)
      if (next?.user) {
        void supabase.rpc('link_collaborator_user_ids')
      }
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    if (error) throw error
    await supabase.rpc('link_collaborator_user_ids')
  }, [])

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const redirectTo = `${window.location.origin}/auth/callback`
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: redirectTo },
    })
    if (error) throw error
    if (data.session) {
      await supabase.rpc('link_collaborator_user_ids')
      return true
    }
    return false
  }, [])

  const signInWithEmail = useCallback(async (email: string) => {
    const redirectTo = `${window.location.origin}/auth/callback`
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signInWithEmail,
      signOut,
    }),
    [session, loading, signInWithPassword, signUpWithPassword, signInWithEmail, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth måste användas inom AuthProvider')
  return ctx
}
