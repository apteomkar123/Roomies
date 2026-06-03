import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { calcChoreAssignee } from '../hooks/useChoreRotation'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import AvatarHalo from '../components/ui/AvatarHalo'
import type { Chore, ChoreAssignment, KarmaMarketplace, Profile } from '../types'
import { format, addDays, startOfDay, isSameDay, differenceInDays } from 'date-fns'

type ChoreRecurrence = 'Twice Weekly' | 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Quarterly'

const RECURRENCE_DAYS: Record<ChoreRecurrence, number> = {
  'Twice Weekly': 3, 'Weekly': 7, 'Bi-Weekly': 14, 'Monthly': 30, 'Quarterly': 91,
}

// Intensity lookup: keyword substrings → difficulty (1–5)
const INTENSITY_RULES: [string[], number][] = [
  [['mail', 'recycl', 'sort'], 1],
  [['trash', 'garbage', 'dishes', 'dishwasher', 'laundry', 'grocery', 'groceries', 'cat litter', 'litter box', 'wipe counter', 'table'], 2],
  [['vacuum', 'sweep', 'kitchen', 'cooking', 'cook dinner', 'windows', 'dusting', 'dust'], 3],
  [['mop', 'bathroom', 'bathrooms', 'toilet', 'scrub', 'shower', 'floors', 'clean bathroom', 'yard'], 4],
  [['deep clean', 'spring clean', 'move furniture', 'garage'], 5],
]

function detectChoreIntensity(title: string): number {
  const lower = title.toLowerCase()
  for (const [keywords, intensity] of INTENSITY_RULES) {
    if (keywords.some(k => lower.includes(k))) return intensity
  }
  return 2
}

const INTENSITY_LABEL: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: 'Easy', color: '#059669', bg: 'rgba(16,185,129,0.1)' },
  2: { label: 'Light', color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  3: { label: 'Medium', color: '#D97706', bg: 'rgba(245,158,11,0.1)' },
  4: { label: 'Hard', color: '#DC2626', bg: 'rgba(239,68,68,0.1)' },
  5: { label: 'Intense', color: '#7C3AED', bg: 'rgba(139,92,246,0.1)' },
}

export default function Chores() {
  const { user, profile } = useAuth()
  const { household, memberProfiles } = useHousehold()
  const [chores, setChores] = useState<Chore[]>([])
  const [assignments, setAssignments] = useState<ChoreAssignment[]>([])
  const [upcomingAssignments, setUpcomingAssignments] = useState<ChoreAssignment[]>([])
  const [marketplace, setMarketplace] = useState<KarmaMarketplace[]>([])
  const [showAddChore, setShowAddChore] = useState(false)
  const [title, setTitle] = useState('')
  const [recurrence, setRecurrence] = useState<ChoreRecurrence>('Weekly')
  const [detectedDifficulty, setDetectedDifficulty] = useState(2)
  const [nutritionBoostActive, setNutritionBoostActive] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  // Reassign UI: holds { choreId, memberId picker open }
  const [reassignChoreId, setReassignChoreId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    supabase.from('cross_app_activity')
      .select('id')
      .eq('user_id', user.id)
      .eq('activity_type', 'nutrition_shortfall')
      .gte('created_at', since)
      .limit(1)
      .then(({ data }) => { if (data?.length) setNutritionBoostActive(true) })
  }, [user])

  useEffect(() => {
    if (!household) return
    loadAll()
    const ch = supabase.channel(`chores:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_assignments' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'karma_marketplace' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    if (!household) return
    const calendarEnd = addDays(new Date(), 14).toISOString()
    const [{ data: c }, { data: a }, { data: m }, { data: upcoming }] = await Promise.all([
      supabase.from('chores').select('*').eq('household_id', household.id),
      supabase.from('chore_assignments').select('*, profiles(username, avatar_url), chores(title)').eq('status', 'Pending'),
      supabase.from('karma_marketplace').select('*, chore_assignments(*, chores(title))').eq('is_open', true),
      supabase.from('chore_assignments')
        .select('*, profiles(username, avatar_url), chores(title)')
        .gte('due_date', startOfDay(new Date()).toISOString())
        .lte('due_date', calendarEnd)
        .order('due_date', { ascending: true }),
    ])
    const choreList = (c ?? []) as Chore[]
    setChores(choreList)

    const choreIds = new Set(choreList.map(ch => ch.id))
    const assignmentList = ((a ?? []) as ChoreAssignment[]).filter(as => choreIds.has(as.chore_id))
    setAssignments(assignmentList)

    setMarketplace(((m ?? []) as KarmaMarketplace[]).filter(item =>
      item.chore_assignments?.chore_id && choreIds.has(item.chore_assignments.chore_id)
    ))

    const upcomingList = ((upcoming ?? []) as ChoreAssignment[]).filter(as => choreIds.has(as.chore_id))
    setUpcomingAssignments(upcomingList)
  }

  async function addChore() {
    if (!title.trim() || !household) return
    setSaveError(null)
    const activeMembers = memberProfiles.filter(m => !m.away)
    const difficulty = detectedDifficulty

    const { data: newChore, error } = await supabase.from('chores')
      .insert({ household_id: household.id, title: title.trim(), recurrence, rotation_offset: 0, difficulty })
      .select().single()
    if (error || !newChore) { setSaveError(error?.message ?? 'Failed'); return }

    if (activeMembers.length > 0) {
      // Build workload map from current pending assignments (intensity × count)
      const workloadMap: Record<string, number> = {}
      for (const m of activeMembers) workloadMap[m.id] = 0
      for (const a of assignments) {
        const c = chores.find(ch => ch.id === a.chore_id)
        workloadMap[a.assigned_to] = (workloadMap[a.assigned_to] ?? 0) + (c?.difficulty ?? 2)
      }

      const periodDays = RECURRENCE_DAYS[recurrence]
      const newAssignments: { chore_id: string; assigned_to: string; due_date: string; status: string }[] = []
      let due = startOfDay(new Date())
      const end = addDays(new Date(), 30)

      while (due <= end) {
        // Assign to the member with the lowest current workload
        let assignee = activeMembers[0]
        for (const m of activeMembers) {
          if ((workloadMap[m.id] ?? 0) < (workloadMap[assignee.id] ?? 0)) assignee = m
        }
        newAssignments.push({ chore_id: newChore.id, assigned_to: assignee.id, due_date: due.toISOString(), status: 'Pending' })
        workloadMap[assignee.id] = (workloadMap[assignee.id] ?? 0) + difficulty
        due = addDays(due, periodDays)
      }

      if (newAssignments.length > 0) {
        await supabase.from('chore_assignments').insert(newAssignments)
        // Sync rotation_offset so calcChoreAssignee matches first assignment
        const firstAssigneeId = newAssignments[0]?.assigned_to
        const firstIdx = activeMembers.findIndex(m => m.id === firstAssigneeId)
        if (firstIdx >= 0) {
          await supabase.from('chores').update({ rotation_offset: firstIdx }).eq('id', newChore.id)
        }
      }
    }

    setTitle(''); setDetectedDifficulty(2); setShowAddChore(false); loadAll()
  }

  async function deleteChore(id: string) {
    await supabase.from('chore_assignments').delete().eq('chore_id', id)
    await supabase.from('chores').delete().eq('id', id)
    loadAll()
  }

  async function markDone(id: string) {
    const doneAssignment = assignments.find(a => a.id === id)
    const choreTitle = chores.find(c => c.id === doneAssignment?.chore_id)?.title ?? 'a chore'
    const choreDifficulty = chores.find(c => c.id === doneAssignment?.chore_id)?.difficulty ?? 2

    await supabase.from('chore_assignments').update({ status: 'Completed', completed_at: new Date().toISOString() }).eq('id', id)
    if (profile) await supabase.from('profiles').update({ karma: (profile.karma ?? 100) + 10 }).eq('id', user!.id)

    supabase.from('cross_app_activity').insert({
      user_id: user!.id,
      app: 'homebase',
      activity_type: 'chore_completed',
      is_public: false,
      payload: { chore_title: choreTitle, difficulty: choreDifficulty, bpm_hint: choreDifficulty * 30 + 60 },
    }).then(() => {})

    const remaining = assignments.filter(a => a.id !== id && a.status === 'Pending')
    if (remaining.length === 0) {
      supabase.from('cross_app_activity').insert({
        user_id: user!.id,
        app: 'homebase',
        activity_type: 'all_chores_done',
        is_public: true,
        payload: { household_id: household?.id, message: 'All chores complete! 🎉' },
      }).then(() => {})
    }

    loadAll()
  }

  async function putOnMarketplace(assignmentId: string) {
    await supabase.from('chore_assignments').update({ status: 'Auctioned' }).eq('id', assignmentId)
    await supabase.from('karma_marketplace').insert({ assignment_id: assignmentId, cash_bounty: 0, karma_bounty: 20 })
    loadAll()
  }

  async function claimFromMarket(item: KarmaMarketplace) {
    await supabase.from('chore_assignments').update({ assigned_to: user!.id, status: 'Pending' }).eq('id', item.assignment_id)
    await supabase.from('karma_marketplace').update({ is_open: false }).eq('id', item.id)
    if (item.karma_bounty > 0) await supabase.from('profiles').update({ karma: (profile?.karma ?? 100) + item.karma_bounty }).eq('id', user!.id)
    loadAll()
  }

  async function reassignChore(chore: Chore, newMember: Profile) {
    const activeMembers = memberProfiles.filter(m => !m.away)
    // Reassign all pending assignments for this chore to the selected member
    await supabase.from('chore_assignments')
      .update({ assigned_to: newMember.id })
      .eq('chore_id', chore.id)
      .eq('status', 'Pending')

    // Update rotation_offset so the formula also points to this member going forward
    const periodDays = RECURRENCE_DAYS[chore.recurrence as ChoreRecurrence] ?? 7
    const elapsed = Math.floor(differenceInDays(new Date(), new Date(chore.created_at)) / periodDays)
    const targetIdx = activeMembers.findIndex(m => m.id === newMember.id)
    if (targetIdx >= 0 && activeMembers.length > 0) {
      const newOffset = ((targetIdx - elapsed) % activeMembers.length + activeMembers.length) % activeMembers.length
      await supabase.from('chores').update({ rotation_offset: newOffset }).eq('id', chore.id)
    }

    setReassignChoreId(null)
    loadAll()
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Chores</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Intensity-balanced assignments</div>
        </div>
        <button onClick={() => setShowAddChore(!showAddChore)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {showAddChore && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
          <input
            className="glass-input"
            placeholder="Chore name (e.g. Take out trash)"
            value={title}
            onChange={e => { setTitle(e.target.value); setDetectedDifficulty(detectChoreIntensity(e.target.value)) }}
            style={{ marginBottom: 8 }}
          />
          {title.trim() && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>Detected intensity:</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: INTENSITY_LABEL[detectedDifficulty].color, background: INTENSITY_LABEL[detectedDifficulty].bg, borderRadius: 6, padding: '2px 8px' }}>
                {detectedDifficulty}/5 · {INTENSITY_LABEL[detectedDifficulty].label}
              </span>
            </div>
          )}
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as ChoreRecurrence)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 14, fontFamily: 'inherit' }}>
            {['Twice Weekly','Weekly','Bi-Weekly','Monthly','Quarterly'].map(r => <option key={r}>{r}</option>)}
          </select>
          <button className="btn-blue" onClick={addChore}>Add Chore</button>
        </GlassPanel>
      )}

      {chores.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>📅 Chore Calendar</div>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)).map((day, i) => {
              const dayAssignments = upcomingAssignments.filter(a => isSameDay(new Date(a.due_date), day))
              const isToday = i === 0
              return (
                <div key={i} style={{ minWidth: 72, borderRadius: 14, padding: '10px 8px', background: isToday ? 'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(139,92,246,0.12))' : 'rgba(0,0,0,0.03)', border: isToday ? '1.5px solid rgba(37,99,235,0.3)' : '1.5px solid transparent', textAlign: 'center' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#2563EB' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{format(day, 'EEE')}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? '#2563EB' : '#374151', margin: '2px 0 8px' }}>{format(day, 'd')}</div>
                  {dayAssignments.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#D1D5DB' }}>—</div>
                  ) : (
                    dayAssignments.map(a => (
                      <div key={a.id} title={`${a.chores?.title ?? 'Chore'} → ${a.profiles?.username ?? '?'}`} style={{ fontSize: 10, fontWeight: 700, marginBottom: 4, background: a.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(37,99,235,0.1)', color: a.status === 'Completed' ? '#059669' : '#1D4ED8', borderRadius: 6, padding: '2px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60 }}>
                        {a.status === 'Completed' ? '✓ ' : ''}{a.chores?.title ?? 'Task'}
                      </div>
                    ))
                  )}
                </div>
              )
            })}
          </div>
        </GlassPanel>
      )}

      {chores.length > 0 && (
        <GlassPanel id="tut-rotation" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>This Week's Rotation</div>
          {chores.map(chore => {
            const assignee = calcChoreAssignee(chore, memberProfiles)
            const myAssignment = assignments.find(a => a.chore_id === chore.id && a.assigned_to === user?.id)
            const diff = chore.difficulty ?? 2
            const intensityInfo = INTENSITY_LABEL[diff] ?? INTENSITY_LABEL[2]
            const isReassigning = reassignChoreId === chore.id
            return (
              <div key={chore.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: isReassigning ? 'none' : '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{chore.title}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: intensityInfo.color, background: intensityInfo.bg, borderRadius: 5, padding: '1px 6px' }}>{intensityInfo.label}</span>
                    </div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{chore.recurrence}</div>
                  </div>
                  {assignee && (
                    <div
                      style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 12, cursor: 'pointer' }}
                      onClick={() => setReassignChoreId(isReassigning ? null : chore.id)}
                      title="Tap to reassign this chore"
                    >
                      <AvatarHalo avatarUrl={assignee.avatar_url} status="Available" size={32} username={assignee.username} />
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{assignee.username}</span>
                    </div>
                  )}
                  {myAssignment && (
                    <button onClick={() => markDone(myAssignment.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, marginRight: 6 }}>✓</button>
                  )}
                  <button onClick={() => deleteChore(chore.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
                </div>

                {/* Inline reassign picker */}
                {isReassigning && (
                  <div style={{ padding: '10px 0 14px', borderBottom: '1px solid rgba(0,0,0,0.06)', background: 'rgba(37,99,235,0.03)', borderRadius: 8, marginBottom: 2 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', marginBottom: 8, paddingLeft: 4 }}>Assign to:</div>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', paddingLeft: 4 }}>
                      {memberProfiles.map(m => (
                        <button
                          key={m.id}
                          onClick={() => reassignChore(chore, m)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: assignee?.id === m.id ? '2px solid #2563EB' : '1.5px solid rgba(0,0,0,0.1)', background: assignee?.id === m.id ? 'rgba(37,99,235,0.1)' : 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: 13, color: '#374151' }}
                        >
                          <AvatarHalo avatarUrl={m.avatar_url} status="Available" size={22} username={m.username} />
                          {m.username}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </GlassPanel>
      )}

      {assignments.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pending Tasks</div>
            {nutritionBoostActive && (
              <div style={{ fontSize: 11, fontWeight: 700, color: '#E76F51', background: 'rgba(231,111,81,0.1)', borderRadius: 8, padding: '3px 8px' }}>
                💪 Boost Mode — high-effort first
              </div>
            )}
          </div>
          {[...assignments].sort((a, b) =>
            nutritionBoostActive
              ? (chores.find(c => c.id === b.chore_id)?.difficulty ?? 2) - (chores.find(c => c.id === a.chore_id)?.difficulty ?? 2)
              : 0
          ).map(a => {
            const isMe = a.assigned_to === user?.id
            return (
              <div key={a.id} style={{ padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{a.chores?.title ?? 'Task'}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF' }}>Due {format(new Date(a.due_date), 'MMM d')}</div>
                </div>
                {isMe && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => markDone(a.id)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>✓ Done</button>
                    <button onClick={() => putOnMarketplace(a.id)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(139,92,246,0.1)', color: '#7C3AED', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Auction</button>
                  </div>
                )}
              </div>
            )
          })}
        </GlassPanel>
      )}

      {marketplace.length > 0 && (
        <GlassPanel id="tut-marketplace" style={{ padding: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Karma Marketplace</div>
          {marketplace.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.chore_assignments?.chores?.title ?? 'Available Task'}</div>
                <div style={{ fontSize: 12, color: '#8B5CF6', fontWeight: 700 }}>+{item.karma_bounty} karma{item.cash_bounty > 0 ? ` · $${item.cash_bounty}` : ''}</div>
              </div>
              <button onClick={() => claimFromMarket(item)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#8B5CF6,#6D28D9)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Claim</button>
            </div>
          ))}
        </GlassPanel>
      )}

      {chores.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🧹</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No chores yet</div>
          <div style={{ fontSize: 14 }}>Add your first chore above</div>
        </div>
      )}
    </div>
  )
}
