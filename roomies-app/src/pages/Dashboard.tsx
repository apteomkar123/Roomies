import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import AvatarHalo from '../components/ui/AvatarHalo'
import type { LockboxSecret, PresenceStatus, Chore, ChoreAssignment, Transaction, MaintenanceTicket, CoLivingAgreement, LeaseInfo } from '../types'
import { format, isSameDay, startOfDay, addDays, differenceInDays, parseISO } from 'date-fns'

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
  const navigate = useNavigate()
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
  const [feedEvents, setFeedEvents] = useState<Array<{ id: string; user_id: string; app: string; activity_type: string; payload: Record<string, string>; created_at: string }>>([])
  const [feedProfiles, setFeedProfiles] = useState<Record<string, string>>({})
  const [feedLoading, setFeedLoading] = useState(false)
  const [weeklyDigest, setWeeklyDigest] = useState<{ groceriesSpent: number; choresDone: number; weekStart: string } | null>(null)
  const [digestLoading, setDigestLoading] = useState(false)
  const [recipeNights, setRecipeNights] = useState<Array<{ id: string; recipe_name: string; scheduled_date: string; notes: string | null }>>([])
  const [recipeNightsLoading, setRecipeNightsLoading] = useState(false)
  const [agreement, setAgreement] = useState<CoLivingAgreement | null>(null)
  const [leaseInfo, setLeaseInfo] = useState<LeaseInfo | null>(null)
  const [now, setNow] = useState(new Date())

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

  // Live clock for quiet hours countdown
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(t)
  }, [])

  function loadAll() { loadLockbox(); loadChores(); loadBills(); loadMaintenance(); loadAgreement(); loadLease(); loadFeed(); loadDigest(); loadRecipeNights() }

  const loadFeed = useCallback(async () => {
    if (!household) return
    setFeedLoading(true)
    const { data: mems } = await supabase.from('household_members').select('profile_id').eq('household_id', household.id)
    const ids = (mems ?? []).map((m: { profile_id: string }) => m.profile_id)
    if (!ids.length) { setFeedLoading(false); return }
    const { data: evts } = await supabase
      .from('cross_app_activity')
      .select('id, user_id, app, activity_type, payload, created_at')
      .in('user_id', ids)
      .not('activity_type', 'in', '("mood_signal","late_night_active","nutrition_shortfall","audio_features_update")')
      .order('created_at', { ascending: false })
      .limit(20)
    type FeedEvent = { id: string; user_id: string; app: string; activity_type: string; payload: Record<string, string>; created_at: string }
    const list = (evts ?? []) as FeedEvent[]
    setFeedEvents(list)
    const uniqueIds = [...new Set(list.map(e => e.user_id))]
    if (uniqueIds.length) {
      const { data: profs } = await supabase.from('profiles').select('id, display_name, username').in('id', uniqueIds)
      const map: Record<string, string> = {}
      ;(profs ?? []).forEach((p: { id: string; display_name?: string | null; username?: string | null }) => { map[p.id] = p.display_name ?? p.username ?? 'Member' })
      setFeedProfiles(map)
    }
    setFeedLoading(false)
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadRecipeNights = useCallback(async () => {
    if (!household) return
    setRecipeNightsLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const twoWeeks = new Date(); twoWeeks.setDate(twoWeeks.getDate() + 14)
    const { data } = await supabase
      .from('recipe_nights')
      .select('id, recipe_name, scheduled_date, notes')
      .eq('household_id', household.id)
      .gte('scheduled_date', today)
      .lte('scheduled_date', twoWeeks.toISOString().split('T')[0])
      .order('scheduled_date', { ascending: true })
    setRecipeNights((data ?? []) as Array<{ id: string; recipe_name: string; scheduled_date: string; notes: string | null }>)
    setRecipeNightsLoading(false)
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadDigest = useCallback(async () => {
    if (!household || !user) return
    setDigestLoading(true)
    const weekStart = new Date()
    weekStart.setDate(weekStart.getDate() - 7)
    weekStart.setHours(0, 0, 0, 0)
    const { data: shopItems } = await supabase
      .from('shopping_list')
      .select('price, is_completed')
      .eq('household_id', household.id)
      .gte('created_at', weekStart.toISOString())
    const groceriesSpent = (shopItems ?? [])
      .filter((i: { price: string | null; is_completed: boolean }) => i.is_completed)
      .reduce((s: number, i: { price: string | null }) => s + (parseFloat(i.price ?? '0') || 0), 0)
    const { data: choreEvts } = await supabase
      .from('cross_app_activity')
      .select('id')
      .eq('activity_type', 'chore_completed')
      .gte('created_at', weekStart.toISOString())
    setWeeklyDigest({
      groceriesSpent,
      choresDone: choreEvts?.length ?? 0,
      weekStart: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    })
    setDigestLoading(false)
  }, [household, user]) // eslint-disable-line react-hooks/exhaustive-deps

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

  async function loadAgreement() {
    if (!household) return
    const { data } = await supabase.from('coliving_agreements').select('*').eq('household_id', household.id).single()
    setAgreement(data as CoLivingAgreement | null)
  }

  async function loadLease() {
    if (!household) return
    const { data } = await supabase.from('lease_info').select('*').eq('household_id', household.id).single()
    setLeaseInfo(data as LeaseInfo | null)
  }

  // Compute quiet hours countdown
  function quietHoursCountdown(): { label: string; mins: number } | null {
    if (!agreement) return null
    const [sh, sm] = agreement.quiet_start.split(':').map(Number)
    const [eh, em] = agreement.quiet_end.split(':').map(Number)
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const startMins = sh * 60 + sm
    const endMins = eh * 60 + em

    // Determine if currently in quiet hours (handles overnight spans)
    const inQuiet = startMins > endMins
      ? (nowMins >= startMins || nowMins < endMins)
      : (nowMins >= startMins && nowMins < endMins)

    if (inQuiet) {
      const minsUntilEnd = endMins > nowMins ? endMins - nowMins : (24 * 60 - nowMins) + endMins
      return { label: 'until quiet hours end', mins: minsUntilEnd }
    } else {
      const minsUntilStart = startMins > nowMins ? startMins - nowMins : (24 * 60 - nowMins) + startMins
      return { label: 'until quiet hours', mins: minsUntilStart }
    }
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

  function feedText(e: { user_id: string; app: string; activity_type: string; payload: Record<string, string> }) {
    const name = feedProfiles[e.user_id] || 'Someone'
    const p = e.payload || {}
    switch (e.activity_type) {
      case 'cooking_started':      return `${name} started cooking ${p.recipe_name || 'a recipe'} 🍳`
      case 'chore_completed':      return `${name} completed "${p.chore || 'a chore'}" ✅`
      case 'all_chores_done':      return `${name} — all household chores done! 🎉`
      case 'all_bills_paid':       return `${name} marked all bills paid 💸`
      case 'shopping_item_added':  return `${name} added "${p.item || 'an item'}" to shopping 🛒`
      case 'record_added':         return `${name} added "${p.album || 'an album'}" to Vinyl 🎶`
      case 'mention_notification': return `${name} mentioned @${p.mentioned_name || 'someone'}`
      case 'soundtrack_of_week':   return `🎵 Top track: "${p.track_title || '?'}" by ${p.artist || '?'}`
      case 'recipe_scheduled':     return `${name} scheduled "${p.recipe_name || 'a recipe'}" for ${p.date || 'tonight'} 🍽️`
      case 'potluck_created':      return `${name} created a potluck / event 🥘`
      default:                     return null
    }
  }
  function feedTimeAgo(d: string) {
    const s = (Date.now() - new Date(d).getTime()) / 1000
    if (s < 60) return 'just now'
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`
    return `${Math.floor(s / 86400)}d ago`
  }

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
            onClick={() => window.dispatchEvent(new Event('homebase-open-nav'))}
            style={{ fontFamily: 'Pacifico, cursive', fontSize: 28, background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', cursor: 'pointer', userSelect: 'none', WebkitUserSelect: 'none' }}
          >
            HomeBase
          </div>
          <div style={{ color: '#374151', fontSize: 15, fontWeight: 700 }}>{greeting(profile?.username)}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {household?.avatar_url && (
              <img src={household.avatar_url} alt="" style={{ width: 18, height: 18, borderRadius: 6, objectFit: 'cover', border: '1.5px solid rgba(37,99,235,0.2)' }} />
            )}
            <div style={{ color: '#6B7280', fontSize: 13, fontWeight: 500 }}>{household?.name ?? 'Your Home'}</div>
          </div>
        </div>
        <AvatarHalo avatarUrl={profile?.homebase_avatar_url ?? profile?.avatar_url ?? null} status={myPresence} size={44} username={profile?.username} />
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
                  <AvatarHalo avatarUrl={p.homebase_avatar_url ?? p.avatar_url} status={getPresenceForMember(p.id)} size={40} username={p.username} />
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
        <GlassPanel onClick={() => navigate('/finance')} style={{ padding: 20, marginBottom: 20, cursor: 'pointer' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>💰 Recent Bills</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>View all →</div>
          </div>
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

      {/* Quiet Hours Countdown */}
      {agreement && (() => {
        const countdown = quietHoursCountdown()
        if (!countdown) return null
        const inQuiet = countdown.label.includes('end')
        const hours = Math.floor(countdown.mins / 60)
        const mins = countdown.mins % 60
        const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
        return (
          <GlassPanel style={{ padding: '14px 16px', marginBottom: 16, background: inQuiet ? 'rgba(139,92,246,0.08)' : 'rgba(37,99,235,0.04)', border: `1.5px solid ${inQuiet ? 'rgba(139,92,246,0.3)' : 'rgba(37,99,235,0.15)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{inQuiet ? '🤫' : '🕐'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: inQuiet ? '#7C3AED' : '#2563EB' }}>
                  {inQuiet ? '🔕 Quiet Hours Active' : '🔔 Quiet Hours Upcoming'}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  <strong>{timeStr}</strong> {countdown.label} · {agreement.quiet_start} – {agreement.quiet_end}
                </div>
              </div>
            </div>
          </GlassPanel>
        )
      })()}

      {/* Lease Countdown */}
      {leaseInfo?.lease_end && (() => {
        const daysLeft = differenceInDays(parseISO(leaseInfo.lease_end), new Date())
        const urgent = daysLeft <= 60
        return (
          <GlassPanel style={{ padding: '14px 16px', marginBottom: 16, background: urgent ? 'rgba(244,63,94,0.06)' : 'rgba(16,185,129,0.04)', border: `1.5px solid ${urgent ? 'rgba(244,63,94,0.25)' : 'rgba(16,185,129,0.15)'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>📄</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: urgent ? '#E11D48' : '#059669' }}>
                  Lease {daysLeft < 0 ? 'Expired' : daysLeft === 0 ? 'Ends Today!' : `Ends in ${daysLeft} day${daysLeft > 1 ? 's' : ''}`}
                </div>
                <div style={{ fontSize: 13, color: '#6B7280' }}>
                  {format(parseISO(leaseInfo.lease_end), 'MMMM d, yyyy')}
                  {leaseInfo.monthly_rent ? ` · $${Number(leaseInfo.monthly_rent).toFixed(0)}/mo` : ''}
                </div>
              </div>
            </div>
          </GlassPanel>
        )
      })()}

      {/* House Rules Quick Reference */}
      {agreement && (
        <GlassPanel style={{ padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>🏠 House Rules</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <div style={{ background: 'rgba(139,92,246,0.07)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Quiet Hours</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#7C3AED' }}>{agreement.quiet_start} – {agreement.quiet_end}</div>
            </div>
            <div style={{ background: 'rgba(37,99,235,0.07)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>Hygiene Score</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2563EB' }}>{'⭐'.repeat(agreement.hygiene_score)} {agreement.hygiene_score}/5</div>
            </div>
          </div>
          {agreement.guest_overstay_rules && (
            <div style={{ marginTop: 8, background: 'rgba(245,158,11,0.07)', borderRadius: 10, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 2 }}>Guest Policy</div>
              <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>{agreement.guest_overstay_rules}</div>
            </div>
          )}
        </GlassPanel>
      )}

      {/* LyfeWare Feed */}
      <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>🌐 LyfeWare Feed</div>
          <button onClick={loadFeed} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2563EB', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Refresh</button>
        </div>
        {feedLoading ? (
          <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Loading…</div>
        ) : feedEvents.filter(e => feedText(e) !== null).length === 0 ? (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>No recent activity. Cook a recipe, complete a chore, or add to the shopping list!</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 320, overflowY: 'auto' }}>
            {feedEvents.map(e => {
              const text = feedText(e)
              if (!text) return null
              const appIcon: Record<string, string> = { pantry: '🥦', homebase: '🏠', vinyl: '🎵' }
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: 'rgba(37,99,235,0.04)', borderRadius: 12, padding: '10px 12px', border: '1px solid rgba(37,99,235,0.08)' }}>
                  <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{appIcon[e.app] || '🌐'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', lineHeight: 1.4 }}>{text}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{feedTimeAgo(e.created_at)}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </GlassPanel>

      {/* Weekly Household Digest */}
      <GlassPanel style={{ padding: 20, marginBottom: 20, background: 'rgba(139,92,246,0.04)', border: '1.5px solid rgba(139,92,246,0.15)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>📊 Weekly Digest</div>
          <button onClick={loadDigest} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B5CF6', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>Refresh</button>
        </div>
        {digestLoading ? (
          <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>Loading…</div>
        ) : weeklyDigest ? (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>This week · since {weeklyDigest.weekStart}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'rgba(16,185,129,0.08)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(16,185,129,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>🛒 Groceries Spent</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#059669', marginTop: 4 }}>${weeklyDigest.groceriesSpent.toFixed(2)}</div>
              </div>
              <div style={{ background: 'rgba(37,99,235,0.08)', borderRadius: 12, padding: '12px 14px', border: '1px solid rgba(37,99,235,0.15)' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase' }}>✅ Chores Done</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: '#2563EB', marginTop: 4 }}>{weeklyDigest.choresDone}</div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ color: '#9CA3AF', fontSize: 13 }}>Tap Refresh to load this week's summary.</div>
        )}
      </GlassPanel>

      {/* Recipe Nights */}
      {(recipeNights.length > 0 || recipeNightsLoading) && (
        <GlassPanel style={{ padding: 20, marginBottom: 20, background: 'rgba(245,158,11,0.04)', border: '1.5px solid rgba(245,158,11,0.18)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>🍽️ Recipe Nights</div>
          {recipeNightsLoading ? (
            <div style={{ color: '#9CA3AF', fontSize: 13, textAlign: 'center', padding: '8px 0' }}>Loading…</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {recipeNights.map(rn => {
                const date = new Date(rn.scheduled_date + 'T00:00:00')
                const label = format(date, 'EEE, MMM d')
                const today = new Date(); today.setHours(0,0,0,0)
                const isToday = date.getTime() === today.getTime()
                return (
                  <div key={rn.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: isToday ? 'rgba(245,158,11,0.1)' : 'rgba(0,0,0,0.03)', borderRadius: 12, padding: '10px 12px', border: isToday ? '1px solid rgba(245,158,11,0.3)' : '1px solid transparent' }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>🍳</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{rn.recipe_name}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{label}{isToday ? ' · Today!' : ''}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassPanel>
      )}

      {/* Lockbox */}
      <GlassPanel id="tut-lockbox" style={{ padding: 20, marginBottom: 20, cursor: 'pointer' }} onClick={() => navigate('/lockbox')}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Property Lockbox</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#2563EB' }}>View all →</div>
        </div>
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
                <button
                  onClick={e => { e.stopPropagation(); setRevealed(prev => { const n = new Set(prev); if (n.has(item.id)) n.delete(item.id); else n.add(item.id); return n }) }}
                  style={{ background: 'rgba(37,99,235,0.1)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 12, color: '#2563EB', fontFamily: 'inherit' }}
                >
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
