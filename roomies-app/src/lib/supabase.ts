import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

if (!supabaseConfigured) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Set them in .env (local) or Netlify environment variables (deployed).')
}

// Use placeholder values so createClient never throws — all calls will simply fail gracefully
export const supabase = createClient(
  supabaseUrl  || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false, // We process hash tokens manually in AuthContext
    },
    realtime: {
      params: { eventsPerSecond: 10 },
    },
  }
)

export type { Session, User } from '@supabase/supabase-js'
