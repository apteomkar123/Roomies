import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'
import type { Household, HouseholdMember, Profile, UserPresence } from '../types'

interface HouseholdCtx {
  household: Household | null
  members: HouseholdMember[]
  memberProfiles: Profile[]
  presences: UserPresence[]
  loading: boolean
  reload: () => Promise<void>
}

const Ctx = createContext<HouseholdCtx | null>(null)

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [memberProfiles, setMemberProfiles] = useState<Profile[]>([])
  const [presences, setPresences] = useState<UserPresence[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!profile?.active_household_id) {
      setHousehold(null); setMembers([]); setMemberProfiles([]); setPresences([])
      return
    }
    setLoading(true)
    const [{ data: hh }, { data: mems }] = await Promise.all([
      supabase.from('households').select('*').eq('id', profile.active_household_id).single(),
      supabase.from('household_members').select('*, profiles(*)').eq('household_id', profile.active_household_id),
    ])
    setHousehold(hh as Household)
    const memberList = (mems ?? []) as HouseholdMember[]
    setMembers(memberList)
    const profiles = memberList.map(m => m.profiles!).filter(Boolean) as Profile[]
    setMemberProfiles(profiles)

    const profileIds = profiles.map(p => p.id)
    if (profileIds.length) {
      const { data: pres } = await supabase.from('user_presence').select('*, profiles(*)').in('profile_id', profileIds)
      setPresences((pres ?? []) as UserPresence[])
    }
    setLoading(false)
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { load() }, [profile?.active_household_id])

  // Real-time: presence changes
  useEffect(() => {
    if (!profile?.active_household_id) return
    const ch = supabase.channel(`presence:${profile.active_household_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [profile?.active_household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Ctx.Provider value={{ household, members, memberProfiles, presences, loading, reload: load }}>
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useHousehold = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useHousehold must be inside HouseholdProvider')
  return ctx
}
