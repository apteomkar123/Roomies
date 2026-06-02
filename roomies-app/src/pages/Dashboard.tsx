import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import AvatarHalo from '../components/ui/AvatarHalo'
import type { LockboxSecret, PresenceStatus, Chore, ChoreAssignment, Transaction, MaintenanceTicket } from '../types'
import { format, isSameDay, startOfDay, addDays } from 'date-fns'

function greeting(name?: string | null) {
  const h = new Date().getHours()
  const word = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return name ? `${word}, ${name}` : word
}

const PRESENCE_OPTIONS: PresenceStatus[] = ['Available', 'Sleeping', 'Quiet Hours / Studying', 'Work From Home', 'Away']

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Open':              { bg: 'rgba(244,63,94,0.1)',   color: '#E11D48' },
  'Vendor Dispatched': { bg: 'rgba(245,158,11,0.1)',  color: '#D97706' },
  'Resolved':          { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
}

const CATEGORY_COLORS: Record<string, string> = {
  'Rent': '#2563EB', 'Groceries': '#10B981', 'Utilities': '#F59E0B',
  'Shared Subscriptions': '#8B5CF6', 'Miscellaneous Ad-Hoc': '#6B7280',
}

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { household, memberProfiles, presences, reload } = useHousehold()

  const [myPresence, setMyPresence] = useState<PresenceStatus>('Available')
  const [lockbox, setLockbox] = useState<LockboxSecret[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [buzzing, setBuzzing] = useState(false)
  const [chores, setChores] = useState<Chore[]>([])
  const [choreAssignments, setChoreAssignments] = useState<ChoreAssignment[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [maintenanceTickets, setMaintenanceTickets] = useState<MaintenanceTicket[]>([])

  useEffect(() => {
    const me = presences.find(p => p.profile_id === user?.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (me) setMyPresence(me.status)
  }, [presences, user])

  useEffect(() => {
    if (!household) return
    loadAll()
    const ch = supabase.channel(`dashboard:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lockbox',               filter: `household_id=eq.${household.id}` }, loadLockbox)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chores',                filter: `household_id=eq.${household.id}` }, loadChores)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'chore_assignments' },    loadChores)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions',           filter: `household_id=eq.${household.id}` }, loadBills)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tickets',    filter: `household_id=eq.${household.id}` }, loadMaintenance)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  function loadAll() { loadLockbox(); loadChores(); loadBills(); loadMaintenance() }

  async function loadLockbox() {
    if (!household) return
    const { data } = await supabase.from('lockbox').select('*').eq('household_id', household.id)
    setLockbox((data ?? []) as LockboxSecret[])
  }

  async function loadChores() {
    if (!household) return
    const calendarEnd = addDays(new Date(), 7).toISOString()
    const [{ data: c }, { data: a }] = await Promise.all([
      supabase.from('chores').select('*').eq('household_id', household.id),
      supabase.from('chore_assignments')
        .select('*, profiles(username, avatar_url), chores(title)')
        .gte('due_date', startOfDay(new Date()).toISOString())
        .lte('due_date', calendarEnd)
        .order('due_date', { ascending: true }),
    ])
    const choreList = (c ?? []) as Chore[]
    setChores(choreList)
    const choreIds = new Set(choreList.map(ch => ch.id))
    setChoreAssignments(((a ?? []) as ChoreAssignment[]).filter(as => choreIds.has(as.chore_id)))
  }

  async function loadBills() {
    if (!household) return
    const { data } = await supabase.from('transactions').select('*, profiles(username)').eq('household_id', household.id).order('created_at', { ascending: false }).limit(5)
    setTransactions((data ?? []) as Transaction[])
  }

  async function loadMaintenance() {
    if (!household) return
    const { data } = await supabase.from('maintenance_tickets').select('*, profiles(username)').eq('household_id', household.id).eq('status', 'Open').order('created_at', { ascending: false })
    setMaintenanceTickets((data ?? []) as MaintenanceTicket[])
  }

  async function updatePresence(status: PresenceStatus) {
    setMyPresence(status)
    await Promise.all([
      supabase.from('user_presence').upsert({ profile_id: user!.id, status }),
      supabase.from('profiles').update({ away: status === 'Away' }).eq('id', user!.id),
    ])
    reload()
  }

  async function sendBuzz(type: 'trash' | 'quiet') {
    if (!household || buzzing) return
    setBuzzing(true)
    const body = type === 'trash' ? '🗑️ Hey! It\'s your turn to take out the trash.' : '🤫 Quiet hours reminder — please keep it down!'
    await supabase.from('notices').insert({ household_id: household.id, author_id: user!.id, body, type: 'Instant Buzz Notification' })
    setTimeout(() => setBuzzing(false), 2000)
  }

  const getPresenceForMember = (profileId: string): PresenceStatus =>
    (presences.find(p => p.profile_id === profileId)?.status ?? 'Available') as PresenceStatus

  const getCustomTextForMember = (profileId: string): string | null =>
    presences.find(p => p.profile_id === profileId)?.custom_text ?? null

  const atStoreMembers = memberProfiles
    .filter(p => p.id !== user?.id)
    .map(p => ({ ...p, storeText: getCustomTextForMember(p.id) }))
    .filter(p => p.storeText?.startsWith('🛒'))

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div
            onClick={() => window.dispatchEvent(new Event('roomies-open-nav'))}
            style={{ fontFamily: 'Pacifico, cursive', fontSize: 28, background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            Roomies
          </div>
          <div style={{ color: '#374151', fontSize: 15, fontWeight: 700 }}>{greeting(profile?.username)}</div>
          <div style={{ color: '#6B7280', fontSize: 13, fontWeight: 500 }}>{household?.name ?? 'Your Home'}</div>
        </div>
        <AvatarHalo avatarUrl={profile?.roomies_avatar_url ?? profile?.avatar_url ?? null} status={myPresence} size={44} username={profile?.username} />
      </div>

      {/* Presence selector */}
      <GlassPanel id="tut-presence" style={{ padding: '14px 16px', marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>My Status</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {PRESENCE_OPTIONS.map(s => (
            <button key={s} onClick={() => updatePresence(s)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 12, fontFamily: 'inherit', background: myPresence === s ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: myPresence === s ? 'white' : '#374151', transition: 'all 0.2s' }}>
              {s}
            </button>
          ))}
        </div>
      </GlassPanel>

      {/* Who's at the store? */}
      {atStoreMembers.length > 0 && (
        <GlassPanel style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🛒</span>
            <div>
              {atStoreMembers.map(p => (
                <div key={p.id} style={{ fontSize: 13, fontWeight: 700, color: '#B45309', marginBottom: 2 }}>
                  {p.username} is {(p.storeText ?? '').replace('🛒 ', '')} — anything to add to the shared list?
                </div>
              ))}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Roommates */}
      {memberProfiles.length > 0 && (
        <GlassPanel style={{ padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>Roommates</div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {memberProfiles.map(p => {
              const customText = getCustomTextForMember(p.id)
              return (
                <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <AvatarHalo avatarUrl={p.roomies_avatar_url ?? p.avatar_url} status={getPresenceForMember(p.id)} size={40} username={p.username} />
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#374151' }}>{p.username}</div>
                  {customText && (
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#D97706', background: 'rgba(245,158,11,0.1)', borderRadius: 6, padding: '1px 6px', maxWidth: 80, textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={customText}>{customText}</div>
                  )}
                  <div style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600 }}>⭐ {p.karma}</div>
                </div>
              )
            })}
          </div>
        </GlassPanel>
      )}

      {/* One-Tap Buzz */}
      <GlassPanel id="tut-buzz" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>One-Tap Buzz</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <button onClick={() => sendBuzz('trash')} disabled={buzzing} style={{ padding: '20px 16px', borderRadius: 18, border: '1.5px solid rgba(245,158,11,0.3)', cursor: 'pointer', background: 'linear-gradient(135deg,rgba(245,158,11,0.15),rgba(245,158,11,0.25))', fontFamily: 'inherit', transition: 'all 0.2s', transform: buzzing ? 'scale(0.97)' : 'scale(1)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🗑️</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Trash Buzz</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Alert the trash duty person</div>
          </button>
          <button onClick={() => sendBuzz('quiet')} disabled={buzzing} style={{ padding: '20px 16px', borderRadius: 18, border: '1.5px solid rgba(139,92,246,0.3)', cursor: 'pointer', background: 'linear-gradient(135deg,rgba(139,92,246,0.1),rgba(139,92,246,0.2))', fontFamily: 'inherit', transition: 'all 0.2s', transform: buzzing ? 'scale(0.97)' : 'scale(1)' }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>🤫</div>
            <div style={{ fontWeight: 800, fontSize: 15 }}>Quiet Buzz</div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>Request house silence</div>
          </button>
        </div>
      </GlassPanel>

      {/* Chore Calendar */}
      {chores.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20, overflowX: 'auto' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>📅 Chore Calendar</div>
          <div style={{ display: 'flex', gap: 10, minWidth: 'max-content' }}>
            {Array.from({ length: 7 }, (_, i) => addDays(new Date(), i)).map((day, i) => {
              const dayAssignments = choreAssignments.filter(a => isSameDay(new Date(a.due_date), day))
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

      {/* Recent Bills */}
      {transactions.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>💰 Recent Bills</div>
          {transactions.slice(0, 3).map(tx => (
            <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[tx.category] ?? '#6B7280', display: 'inline-block', flexShrink: 0 }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{tx.memo || tx.category}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>by {tx.profiles?.username} · {format(new Date(tx.created_at), 'MMM d')}</div>
                </div>
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, color: tx.paid_by === user?.id ? '#10B981' : '#374151' }}>${Number(tx.amount).toFixed(2)}</span>
            </div>
          ))}
        </GlassPanel>
      )}

      {/* Pending Maintenance */}
      {maintenanceTickets.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>🔧 Pending Maintenance</div>
          {maintenanceTickets.map(t => {
            const st = STATUS_STYLE[t.status] ?? STATUS_STYLE['Open']
            return (
              <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{t.title}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>by {t.profiles?.username} · {format(new Date(t.created_at), 'MMM d')}</div>
                </div>
                <span style={{ background: st.bg, color: st.color, padding: '3px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.status}</span>
              </div>
            )
          })}
        </GlassPanel>
      )}

      {/* Lockbox */}
      <GlassPanel id="tut-lockbox" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Property Lockbox</div>
        {lockbox.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 14 }}>No secrets stored yet. Add them in the Lockbox page.</div>}
        {lockbox.map(item => {
          const isHidden = item.is_restricted && !revealed.has(item.id)
          return (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{item.key_name}</div>
                <div style={{ fontSize: 13, color: isHidden ? '#9CA3AF' : '#374151', marginTop: 2, fontFamily: 'monospace' }}>
                  {isHidden ? '••••••••' : item.value}
                </div>
              </div>
              {item.is_restricted && (
                <button onClick={() => setRevealed(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n })} style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#2563EB', fontFamily: 'inherit' }}>
                  {isHidden ? 'Reveal' : 'Hide'}
                </button>
              )}
            </div>
          )
        })}
      </GlassPanel>
    </div>
  )
}
