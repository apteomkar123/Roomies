import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import AvatarHalo from '../components/ui/AvatarHalo'
import NavBar from '../components/ui/NavBar'
import type { Booking, LockboxSecret, PetLog, PresenceStatus } from '../types'
import { format, isSameDay, startOfDay } from 'date-fns'

const PRESENCE_OPTIONS: PresenceStatus[] = ['Available', 'Sleeping', 'Quiet Hours / Studying', 'Work From Home', 'Away']
const DEFAULT_RESOURCES = ['Washing Machine', 'Dryer', 'Parking Bay A', 'Parking Bay B', 'BBQ', 'Rooftop']
const PET_ACTIONS = ['Morning Feed', 'Evening Feed', 'Daily Walk', 'Medication Administered'] as const

export default function Dashboard() {
  const { user, profile } = useAuth()
  const { household, memberProfiles, presences, reload } = useHousehold()

  const [myPresence, setMyPresence] = useState<PresenceStatus>('Available')
  const [bookings, setBookings] = useState<Booking[]>([])
  const [petLogs, setPetLogs] = useState<PetLog[]>([])
  const [lockbox, setLockbox] = useState<LockboxSecret[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [petName, setPetName] = useState('Buddy')
  const [buzzing, setBuzzing] = useState(false)
  const [customResources, setCustomResources] = useState<string[]>([])
  const [newResourceName, setNewResourceName] = useState('')
  const [showAddResource, setShowAddResource] = useState(false)

  useEffect(() => {
    const me = presences.find(p => p.profile_id === user?.id)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (me) setMyPresence(me.status)
  }, [presences, user])

  useEffect(() => {
    if (!household) return
    const stored = localStorage.getItem(`custom-resources-${household.id}`)
    if (stored) setCustomResources(JSON.parse(stored))
  }, [household?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!household) return
    loadBookings()
    loadPetLogs()
    loadLockbox()

    const ch = supabase.channel(`dashboard:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings', filter: `household_id=eq.${household.id}` }, loadBookings)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pet_logs',  filter: `household_id=eq.${household.id}` }, loadPetLogs)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadBookings() {
    if (!household) return
    const { data } = await supabase.from('bookings').select('*, profiles(username)').eq('household_id', household.id)
    setBookings((data ?? []) as Booking[])
  }

  async function loadPetLogs() {
    if (!household) return
    const today = startOfDay(new Date()).toISOString()
    const { data } = await supabase.from('pet_logs').select('*, profiles(username)').eq('household_id', household.id).gte('action_at', today)
    setPetLogs((data ?? []) as PetLog[])
  }

  async function loadLockbox() {
    if (!household) return
    const { data } = await supabase.from('lockbox').select('*').eq('household_id', household.id)
    setLockbox((data ?? []) as LockboxSecret[])
  }

  async function updatePresence(status: PresenceStatus) {
    setMyPresence(status)
    await Promise.all([
      supabase.from('user_presence').upsert({ profile_id: user!.id, status }),
      supabase.from('profiles').update({ away: status === 'Away' }).eq('id', user!.id),
    ])
    reload()
  }

  async function bookSlot(resource: string, hour: number) {
    if (!household) return
    const start = new Date(); start.setHours(hour, 0, 0, 0)
    const end   = new Date(); end.setHours(hour + 1, 0, 0, 0)
    await supabase.from('bookings').insert({ household_id: household.id, booked_by: user!.id, resource_name: resource, start_time: start.toISOString(), end_time: end.toISOString() })
    loadBookings()
  }

  async function cancelSlot(bookingId: string) {
    await supabase.from('bookings').delete().eq('id', bookingId)
    loadBookings()
  }

  function addCustomResource() {
    if (!newResourceName.trim() || !household) return
    const updated = [...customResources, newResourceName.trim()]
    setCustomResources(updated)
    localStorage.setItem(`custom-resources-${household.id}`, JSON.stringify(updated))
    setNewResourceName('')
    setShowAddResource(false)
  }

  function removeCustomResource(name: string) {
    if (!household) return
    const updated = customResources.filter(r => r !== name)
    setCustomResources(updated)
    localStorage.setItem(`custom-resources-${household.id}`, JSON.stringify(updated))
  }

  function getBookingOwner(resource: string, hour: number) {
    return bookings.find(b => {
      const start = new Date(b.start_time)
      const end   = new Date(b.end_time)
      return b.resource_name === resource && isSameDay(start, new Date()) && hour >= start.getHours() && hour < end.getHours()
    })
  }

  async function logPetAction(action: typeof PET_ACTIONS[number]) {
    if (!household) return
    await supabase.from('pet_logs').insert({ household_id: household.id, pet_name: petName, action, done_by: user!.id })
    loadPetLogs()
  }

  async function sendBuzz(type: 'trash' | 'quiet') {
    if (!household || buzzing) return
    setBuzzing(true)
    const body = type === 'trash' ? '🗑️ Hey! It\'s your turn to take out the trash.' : '🤫 Quiet hours reminder — please keep it down!'
    await supabase.from('notices').insert({ household_id: household.id, author_id: user!.id, body, type: 'Instant Buzz Notification' })
    setTimeout(() => setBuzzing(false), 2000)
  }

  const getPresenceForMember = (profileId: string): PresenceStatus => {
    return (presences.find(p => p.profile_id === profileId)?.status ?? 'Available') as PresenceStatus
  }

  const getCustomTextForMember = (profileId: string): string | null => {
    return presences.find(p => p.profile_id === profileId)?.custom_text ?? null
  }

  const atStoreMembres = memberProfiles
    .filter(p => p.id !== user?.id)
    .map(p => ({ ...p, storeText: getCustomTextForMember(p.id) }))
    .filter(p => p.storeText?.startsWith('🛒'))

  const profileColorMap: Record<string, string> = {}
  const colors = ['#2563EB','#10B981','#8B5CF6','#F59E0B','#F43F5E','#06B6D4']
  memberProfiles.forEach((p, i) => { profileColorMap[p.id] = colors[i % colors.length] })

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 28, background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Roomies
          </div>
          <div style={{ color: '#6B7280', fontSize: 14, fontWeight: 500 }}>{household?.name ?? 'Your Home'}</div>
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

      {/* Feature #7: Who's Home? — grocery store alert */}
      {atStoreMembres.length > 0 && (
        <GlassPanel style={{ padding: '12px 16px', marginBottom: 16, background: 'rgba(245,158,11,0.08)', border: '1.5px solid rgba(245,158,11,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
            <span style={{ fontSize: 18 }}>🛒</span>
            <div>
              {atStoreMembres.map(p => (
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

      {/* Widget 1: Buzz Deck */}
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

      {/* Widget 2: Utility Booker */}
      <GlassPanel id="tut-appliance" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Utility Booker</div>
          <button onClick={() => setShowAddResource(v => !v)} style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: 'rgba(37,99,235,0.08)', border: 'none', borderRadius: 8, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add Utility
          </button>
        </div>
        {showAddResource && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <input
              className="glass-input"
              placeholder="Utility name (e.g. Gym, Pool)"
              value={newResourceName}
              onChange={e => setNewResourceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustomResource()}
              style={{ fontSize: 13 }}
            />
            <button onClick={addCustomResource} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', fontSize: 13 }}>Add</button>
          </div>
        )}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, width: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 10px', color: '#9CA3AF', fontWeight: 700, width: 120 }}>Resource</th>
                {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => (
                  <th key={h} style={{ padding: '4px 3px', color: '#9CA3AF', fontWeight: 600, width: 28, textAlign: 'center' }}>{h < 12 ? `${h}a` : h === 12 ? '12p' : `${h-12}p`}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...DEFAULT_RESOURCES, ...customResources].map(res => (
                <tr key={res}>
                  <td style={{ padding: '6px 10px', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap' }}>
                    {res}
                    {customResources.includes(res) && (
                      <button onClick={() => removeCustomResource(res)} style={{ marginLeft: 4, background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 11, padding: 0 }}>✕</button>
                    )}
                  </td>
                  {[6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23].map(h => {
                    const booking = getBookingOwner(res, h)
                    const color = booking ? (profileColorMap[booking.booked_by] ?? '#2563EB') : undefined
                    const isMe = booking?.booked_by === user?.id
                    return (
                      <td key={h} style={{ padding: 3, textAlign: 'center' }}>
                        <div
                          onClick={() => {
                            if (isMe) cancelSlot(booking!.id)
                            else if (!booking) bookSlot(res, h)
                          }}
                          title={isMe ? 'Tap to cancel your booking' : booking ? `Booked by ${booking.profiles?.username}` : 'Tap to book'}
                          style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: color ? color + '33' : 'rgba(0,0,0,0.05)',
                            border: color ? `1.5px solid ${color}` : '1.5px solid transparent',
                            cursor: booking && !isMe ? 'default' : 'pointer',
                            margin: '0 auto',
                            boxShadow: isMe ? `0 0 6px ${color}88` : undefined,
                            transition: 'all 0.15s',
                          }}
                        />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Widget 3: Pet Tracker */}
      <GlassPanel id="tut-pets" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Pet Care</div>
          <input value={petName} onChange={e => setPetName(e.target.value)} style={{ background: 'none', border: 'none', fontWeight: 800, fontSize: 14, color: '#374151', outline: 'none', width: 100, textAlign: 'right', fontFamily: 'inherit' }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {PET_ACTIONS.map(action => {
            const done = petLogs.find(l => l.action === action && l.pet_name === petName)
            return (
              <button key={action} onClick={() => !done && logPetAction(action)} style={{ padding: '14px 12px', borderRadius: 16, border: done ? '1.5px solid rgba(16,185,129,0.35)' : '1.5px solid transparent', cursor: done ? 'default' : 'pointer', fontFamily: 'inherit', background: done ? 'rgba(16,185,129,0.12)' : 'rgba(0,0,0,0.05)', transition: 'all 0.2s', textAlign: 'left' }}>
                <div style={{ fontWeight: 800, fontSize: 13, color: done ? '#059669' : '#374151' }}>{done ? '✓ ' : ''}{action}</div>
                {done && <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>by {done.profiles?.username} · {format(new Date(done.action_at), 'h:mm a')}</div>}
              </button>
            )
          })}
        </div>
      </GlassPanel>

      {/* Widget 4: Lockbox */}
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
