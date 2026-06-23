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
  const { profile, refreshProfile } = useAuth()
  const [household, setHousehold] = useState<Household | null>(null)
  const [members, setMembers] = useState<HouseholdMember[]>([])
  const [memberProfiles, setMemberProfiles] = useState<Profile[]>([])
  const [presences, setPresences] = useState<UserPresence[]>([])
  const [loading, setLoading] = useState(false)

  const load = async () => {
    if (!profile?.active_household_id) {
      // Fallback: if profiles.active_household_id is null (e.g. after a delete or first
      // login after a DB inconsistency), check household_members for any membership
      // and self-heal so the rest of the app isn't stuck on an empty state.
      if (profile?.id) {
        const { data: memberRows } = await supabase
          .from('household_members')
          .select('household_id')
          .eq('profile_id', profile.id)
          .limit(1)
        if (memberRows && memberRows.length > 0) {
          const healId = memberRows[0].household_id
          await supabase.from('profiles').update({ active_household_id: healId }).eq('id', profile.id)
          await supabase.auth.updateUser({ data: { active_household_id: healId } })
          await refreshProfile() // triggers re-render → load() re-runs with the new value
          return
        }
      }
      setHousehold(null); setMembers([]); setMemberProfiles([]); setPresences([])
      return
    }
    setLoading(true)
    const [{ data: hh }, { data: mems }] = await Promise.all([
      supabase.from('households').select('*').eq('id', profile.active_household_id).single(),
      supabase.from('household_members').select('*, profiles(*)').eq('household_id', profile.active_household_id),
    ])
    setHousehold(hh as Household)
    let memberList = (mems ?? []) as HouseholdMember[]

    // Auto-repair: active_household_id is set but user is not in household_members.
    // This happens when onboarding fails mid-way or the DB membership row was lost.
    // Re-inserting restores RLS access for all subsequent writes.
    if (hh && profile && !memberList.some(m => m.profile_id === profile.id)) {
      const { error } = await supabase
        .from('household_members')
        .insert({ household_id: profile.active_household_id, profile_id: profile.id, role: 'Tenant' })
      if (!error || error.code === '23505') {
        const { data: freshMems } = await supabase
          .from('household_members')
          .select('*, profiles(*)')
          .eq('household_id', profile.active_household_id)
        memberList = (freshMems ?? []) as HouseholdMember[]
      }
    }

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
