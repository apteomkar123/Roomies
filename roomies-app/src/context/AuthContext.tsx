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
  signInWithLyfeWare: () => void
  sendPasswordReset: (email: string) => Promise<{ error: string | null }>
  updatePassword: (password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateAvatar: (file: File, type?: 'global' | 'homebase') => Promise<void>
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
    // Extract hash tokens BEFORE subscribing — with detectSessionInUrl:false the
    // Supabase client will NOT auto-process the hash, so our manual setSession()
    // below is the ONLY thing that consumes these tokens.  Doing this first and
    // clearing the URL prevents any accidental double-processing that would rotate
    // the refresh token and fire a SIGNED_OUT, causing the login loop.
    const hash = window.location.hash
    const params = new URLSearchParams(hash.substring(1))
    const at = params.get('access_token')
    const rt = params.get('refresh_token')
    const hasHashTokens = !!(at && rt)

    if (hasHashTokens) {
      window.history.replaceState(null, '', window.location.pathname)
    }

    // Safety timeout only for non-hash flows. INITIAL_SESSION fires almost
    // immediately from localStorage; this is just a last-resort fallback.
    const timeout = hasHashTokens ? undefined : setTimeout(() => setLoading(false), 10000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      // During hash-token injection the first INITIAL_SESSION has no session yet.
      // Skip it so we don't set loading=false and flash the login screen before
      // the subsequent SIGNED_IN (or PASSWORD_RECOVERY) event arrives.
      if (event === 'INITIAL_SESSION' && !s?.user && hasHashTokens) return

      setSession(s)
      setUser(s?.user ?? null)
      if (event === 'PASSWORD_RECOVERY') setNeedsPasswordReset(true)
      if (s?.user) {
        fetchProfile(s.user.id, s.user.email ?? undefined).finally(() => {
          if (timeout) clearTimeout(timeout)
          setLoading(false)
        })
      } else {
        if (timeout) clearTimeout(timeout)
        setProfile(null)
        setLoading(false)
      }
    })

    if (hasHashTokens && at && rt) {
      // Inject LyfeWare SSO or password-reset tokens.  On success Supabase fires
      // SIGNED_IN / PASSWORD_RECOVERY which the handler above picks up.
      // On failure (expired / wrong project) we reset to unauthenticated state.
      supabase.auth.setSession({ access_token: at, refresh_token: rt })
        .then(({ error }) => {
          if (error) {
            setSession(null)
            setUser(null)
            setProfile(null)
            setLoading(false)
          }
        })
    }

    return () => {
      if (timeout) clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signInWithLyfeWare = () => {
    window.location.href = `https://authlyfeware.netlify.app?redirect_to=${encodeURIComponent(window.location.href)}`
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

  const updateAvatar = async (file: File, type: 'global' | 'homebase' = 'global') => {
    if (!user) return
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = type === 'homebase' ? `homebase.${ext}` : `avatar.${ext}`
    const path = `${user.id}/${filename}`
    const { error } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true })
    if (error) return
    const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path)
    const col = type === 'homebase' ? 'homebase_avatar_url' : 'avatar_url'
    await supabase.from('profiles').update({ [col]: publicUrl }).eq('id', user.id)
    setProfile(prev => prev ? { ...prev, [col]: publicUrl } : prev)
  }

  return (
    <Ctx.Provider value={{ session, user, profile, loading, needsPasswordReset, signInWithEmail, signUpWithEmail, signInWithLyfeWare, sendPasswordReset, updatePassword, signOut, refreshProfile, updateAvatar }}>
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
