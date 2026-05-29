import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase, type Session, type User } from '../lib/supabase'
import type { Profile } from '../types'

interface AuthCtx {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  needsPasswordReset: boolean
  signInWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithEmail: (email: string, password: string) => Promise<{ error: string | null }>
  signInWithAppWare: () => void
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)

  const fetchProfile = async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) setProfile(data as Profile)
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    // Must subscribe before getSession — in Supabase v2 PKCE, onAuthStateChange fires
    // INITIAL_SESSION which triggers the URL code exchange for OAuth callbacks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      clearTimeout(timeout)
      setSession(s)
      setUser(s?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setNeedsPasswordReset(true)
      if (s?.user) fetchProfile(s.user.id).finally(() => setLoading(false))
      else { setProfile(null); setLoading(false) }
    })

    // AppWare SSO: if redirected back from the AppWare portal with hash tokens, inject session
    const hash = window.location.hash
    if (hash.includes('access_token=')) {
      const params = new URLSearchParams(hash.substring(1))
      const at = params.get('access_token')
      const rt = params.get('refresh_token')
      if (at && rt) {
        window.history.replaceState(null, '', window.location.pathname)
        supabase.auth.setSession({ access_token: at, refresh_token: rt })
          .catch(() => { clearTimeout(timeout); setLoading(false) })
      }
    }

    // Fallback: if INITIAL_SESSION doesn't fire (no auth event), resolve loading
    supabase.auth.getSession().catch(() => { clearTimeout(timeout); setLoading(false) })

    return () => subscription.unsubscribe()
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithAppWare = () => {
    window.location.href = `https://appware-auth.netlify.app?redirect_to=${encodeURIComponent(window.location.href)}`
  }

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: APP_URL,
    })
    return { error: error?.message ?? null }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    if (!error) setNeedsPasswordReset(false)
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id)
  }

  return (
    <Ctx.Provider value={{ session, user, profile, loading, needsPasswordReset, signInWithEmail, signUpWithEmail, signInWithAppWare, sendPasswordReset, updatePassword, signOut, refreshProfile }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
