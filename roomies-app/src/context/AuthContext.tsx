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
  updateAvatar: (file: File, type?: 'global' | 'roomies') => Promise<void>
}

const Ctx = createContext<AuthCtx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [needsPasswordReset, setNeedsPasswordReset] = useState(false)

  const fetchProfile = async (uid: string, email?: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data as Profile)
      return
    }
    // Profile missing — DB trigger either failed silently or hasn't run yet.
    // Create the row client-side so onboarding can proceed.
    if (email) {
      let username = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || uid.slice(0, 8)
      const { error } = await supabase.from('profiles').insert({ id: uid, username })
      if (error?.code === '23505') {
        // Username already taken — append random suffix
        username = `${username}_${Math.random().toString(36).slice(2, 6)}`
        await supabase.from('profiles').insert({ id: uid, username })
      }
      const { data: created } = await supabase.from('profiles').select('*').eq('id', uid).single()
      if (created) setProfile(created as Profile)
    }
  }

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000)

    // Detect AppWare SSO tokens in the hash BEFORE subscribing so the
    // INITIAL_SESSION "no user" event doesn't set loading=false and bounce
    // the user back to the login screen before setSession resolves.
    const hash = window.location.hash
    const pendingSSO = hash.includes('access_token=')

    // Must subscribe before getSession — in Supabase v2 PKCE, onAuthStateChange fires
    // INITIAL_SESSION which triggers the URL code exchange for OAuth callbacks.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // During SSO the null INITIAL_SESSION can arrive after (or race with) the real
      // SIGNED_IN fired by setSession — ignore it so we don't wipe the user state or
      // cancel the safety timeout before the profile fetch has a chance to run.
      if (event === 'INITIAL_SESSION' && !s?.user && pendingSSO) return

      setSession(s)
      setUser(s?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setNeedsPasswordReset(true)
      if (s?.user) {
        // Keep the timeout alive until fetchProfile resolves — it acts as a failsafe
        // in case the DB query hangs (e.g. degraded network).
        fetchProfile(s.user.id, s.user.email ?? undefined).finally(() => {
          clearTimeout(timeout)
          setLoading(false)
        })
      } else {
        clearTimeout(timeout)
        setProfile(null)
        setLoading(false)
      }
    })

    // AppWare SSO: inject the hash tokens into the Supabase session
    if (pendingSSO) {
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
    window.location.href = `https://authappware.netlify.app?redirect_to=${encodeURIComponent(window.location.href)}`
  }

  const sendPasswordReset = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
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
    if (user) await fetchProfile(user.id, user.email ?? undefined)
  }

  const updateAvatar = async (file: File, type: 'global' | 'roomies' = 'global') => {
    if (!user) return
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = type === 'roomies' ? `roomies.${ext}` : `avatar.${ext}`
    const path = `${user.id}/${filename}`
    const { error } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true })
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path)
    const col = type === 'roomies' ? 'roomies_avatar_url' : 'avatar_url'
    await supabase.from('profiles').update({ [col]: publicUrl }).eq('id', user.id)
    setProfile(prev => prev ? { ...prev, [col]: publicUrl } : prev)
  }

  return (
    <Ctx.Provider value={{ session, user, profile, loading, needsPasswordReset, signInWithEmail, signUpWithEmail, signInWithAppWare, sendPasswordReset, updatePassword, signOut, refreshProfile, updateAvatar }}>
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
