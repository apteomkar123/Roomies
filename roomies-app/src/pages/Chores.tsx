import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { calcChoreAssignee } from '../hooks/useChoreRotation'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'
import AvatarHalo from '../components/ui/AvatarHalo'
import type { Chore, ChoreAssignment, KarmaMarketplace } from '../types'
import { format, addDays, startOfDay, isSameDay } from 'date-fns'

type ChoreRecurrence = 'Twice Weekly' | 'Weekly' | 'Bi-Weekly' | 'Monthly' | 'Quarterly'

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
  const [nutritionBoostActive, setNutritionBoostActive] = useState(false)

  // Feature #14: Nutritional BPM — if Hungry flagged a shortfall, sort high-difficulty chores first
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

    const assignmentIds = new Set(assignmentList.map(as => as.id))
    setMarketplace(((m ?? []) as KarmaMarketplace[]).filter(item => assignmentIds.has(item.assignment_id)))

    // Calendar: all upcoming (pending/completed) assignments for the next 14 days
    const upcomingList = ((upcoming ?? []) as ChoreAssignment[]).filter(as => choreIds.has(as.chore_id))
    setUpcomingAssignments(upcomingList)
  }

  async function addChore() {
    if (!title.trim() || !household) return
    await supabase.from('chores').insert({ household_id: household.id, title: title.trim(), recurrence })
    setTitle(''); setShowAddChore(false); loadAll()
  }

  async function markDone(id: string) {
    const doneAssignment = assignments.find(a => a.id === id)
    const choreTitle = chores.find(c => c.id === doneAssignment?.chore_id)?.title ?? 'a chore'
    const choreDifficulty = chores.find(c => c.id === doneAssignment?.chore_id)?.difficulty ?? 2

    await supabase.from('chore_assignments').update({ status: 'Completed', completed_at: new Date().toISOString() }).eq('id', id)
    if (profile) await supabase.from('profiles').update({ karma: (profile.karma ?? 100) + 10 }).eq('id', user!.id)

    // Feature #2: Chore-Sync Anthems — signal Jukebox to queue BPM-matched playlist
    supabase.from('cross_app_activity').insert({
      user_id: user!.id,
      app: 'roomies',
      activity_type: 'chore_completed',
      is_public: false,
      payload: { chore_title: choreTitle, difficulty: choreDifficulty, bpm_hint: choreDifficulty * 30 + 60 },
    }).then(() => {})

    // Feature #8: Victory Fanfare — if all pending assignments are now done, signal celebration
    const remaining = assignments.filter(a => a.id !== id && a.status === 'Pending')
    if (remaining.length === 0) {
      supabase.from('cross_app_activity').insert({
        user_id: user!.id,
        app: 'roomies',
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

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Chores</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Rotation-based assignments</div>
        </div>
        <button onClick={() => setShowAddChore(!showAddChore)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {/* Add chore panel */}
      {showAddChore && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <input className="glass-input" placeholder="Chore name (e.g. Take out trash)" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
          <select value={recurrence} onChange={e => setRecurrence(e.target.value as ChoreRecurrence)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 14, fontFamily: 'inherit' }}>
            {['Twice Weekly','Weekly','Bi-Weekly','Monthly','Quarterly'].map(r => <option key={r}>{r}</option>)}
          </select>
          <button className="btn-blue" onClick={addChore}>Add Chore</button>
        </GlassPanel>
      )}

      {/* Chore Calendar — next 14 days */}
      {chores.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>📅 Chore Calendar</div>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {Array.from({ length: 14 }, (_, i) => addDays(new Date(), i)).map(day => {
              const dayAssignments = upcomingAssignments.filter(a => isSameDay(new Date(a.due_date), day))
              const isToday = i === 0
              return (
                <div
                  key={i}
                  style={{
                    minWidth: 72, borderRadius: 14, padding: '10px 8px',
                    background: isToday ? 'linear-gradient(135deg,rgba(37,99,235,0.12),rgba(139,92,246,0.12))' : 'rgba(0,0,0,0.03)',
                    border: isToday ? '1.5px solid rgba(37,99,235,0.3)' : '1.5px solid transparent',
                    textAlign: 'center',
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? '#2563EB' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    {format(day, 'EEE')}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? '#2563EB' : '#374151', margin: '2px 0 8px' }}>
                    {format(day, 'd')}
                  </div>
                  {dayAssignments.length === 0 ? (
                    <div style={{ fontSize: 10, color: '#D1D5DB' }}>—</div>
                  ) : (
                    dayAssignments.map(a => (
                      <div
                        key={a.id}
                        title={`${a.chores?.title ?? 'Chore'} → ${a.profiles?.username ?? '?'}`}
                        style={{
                          fontSize: 10, fontWeight: 700, marginBottom: 4,
                          background: a.status === 'Completed' ? 'rgba(16,185,129,0.15)' : 'rgba(37,99,235,0.1)',
                          color: a.status === 'Completed' ? '#059669' : '#1D4ED8',
                          borderRadius: 6, padding: '2px 5px',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 60,
                        }}
                      >
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

      {/* Rotation view for next 7 days */}
      {chores.length > 0 && (
        <GlassPanel id="tut-rotation" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>This Week's Rotation</div>
          {chores.map(chore => {
            const assignee = calcChoreAssignee(chore, memberProfiles)
            return (
              <div key={chore.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{chore.title}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{chore.recurrence}</div>
                </div>
                {assignee && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <AvatarHalo avatarUrl={assignee.avatar_url} status="Available" size={32} username={assignee.username} />
                    <span style={{ fontWeight: 700, fontSize: 13 }}>{assignee.username}</span>
                  </div>
                )}
              </div>
            )
          })}
        </GlassPanel>
      )}

      {/* Pending assignments */}
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
          {/* Feature #14: Sort high-difficulty chores first when nutrition shortfall detected */}
          {[...assignments].sort((a, b) =>
            nutritionBoostActive
              ? (chores.find(c => c.id === b.chore_id)?.difficulty ?? 2) -
                (chores.find(c => c.id === a.chore_id)?.difficulty ?? 2)
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

      {/* Karma marketplace */}
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
