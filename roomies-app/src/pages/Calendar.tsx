import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { HouseEvent } from '../types'
import { format, isSameDay, isBefore, parseISO, addDays } from 'date-fns'

const EVENT_ICONS: Record<string, string> = {
  party: '🎉', inspection: '🔍', lease: '📄', cleaning: '🧹',
  meeting: '👥', move: '📦', maintenance: '🔧', default: '📅'
}

function getEventIcon(title: string): string {
  const lower = title.toLowerCase()
  if (lower.includes('party') || lower.includes('gathering') || lower.includes('birthday')) return '🎉'
  if (lower.includes('inspect') || lower.includes('visit')) return '🔍'
  if (lower.includes('lease') || lower.includes('renewal') || lower.includes('sign')) return '📄'
  if (lower.includes('clean') || lower.includes('deep')) return '🧹'
  if (lower.includes('meeting') || lower.includes('discussion')) return '👥'
  if (lower.includes('move') || lower.includes('delivery')) return '📦'
  if (lower.includes('maintenance') || lower.includes('repair') || lower.includes('fix')) return '🔧'
  return '📅'
}

export default function Calendar() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [events, setEvents] = useState<HouseEvent[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventTime, setEventTime] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`calendar:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'house_events', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const { data } = await supabase
      .from('house_events')
      .select('*, profiles!created_by(username)')
      .eq('household_id', household.id)
      .order('event_date', { ascending: true })
    setEvents((data ?? []) as HouseEvent[])
  }

  async function addEvent() {
    if (!title.trim() || !eventDate || !household) return
    setSaveError(null)
    const { error } = await supabase.from('house_events').insert({
      household_id: household.id,
      created_by: user!.id,
      title: title.trim(),
      description: description.trim() || null,
      event_date: eventDate,
      event_time: eventTime || null,
    })
    if (error) { setSaveError(error.message); return }
    setTitle(''); setDescription(''); setEventDate(''); setEventTime(''); setShowAdd(false)
    load()
  }

  async function deleteEvent(id: string) {
    await supabase.from('house_events').delete().eq('id', id)
    load()
  }

  const today = new Date()
  const upcoming = events.filter(e => !isBefore(parseISO(e.event_date), today) || isSameDay(parseISO(e.event_date), today))
  const past = events.filter(e => isBefore(parseISO(e.event_date), today) && !isSameDay(parseISO(e.event_date), today))

  const next30 = upcoming.filter(e => {
    const d = parseISO(e.event_date)
    return !isBefore(d, today) && isBefore(d, addDays(today, 31))
  })

  return (
    <div id="tut-calendar" style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>House Calendar</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Shared events & dates</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Event
        </button>
      </div>

      {/* Next 30 days mini-calendar */}
      {next30.length > 0 && (
        <GlassPanel style={{ padding: 16, marginBottom: 20, background: 'rgba(37,99,235,0.04)', border: '1.5px solid rgba(37,99,235,0.15)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Next 30 Days</div>
          {next30.map(e => {
            const d = parseISO(e.event_date)
            const isToday = isSameDay(d, today)
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <div style={{ minWidth: 44, textAlign: 'center', background: isToday ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(0,0,0,0.06)', borderRadius: 10, padding: '6px 4px' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: isToday ? 'rgba(255,255,255,0.7)' : '#9CA3AF', textTransform: 'uppercase' }}>{format(d, 'MMM')}</div>
                  <div style={{ fontSize: 18, fontWeight: 900, color: isToday ? 'white' : '#374151', lineHeight: 1 }}>{format(d, 'd')}</div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{getEventIcon(e.title)} {e.title}</div>
                  {e.event_time && <div style={{ fontSize: 12, color: '#6B7280' }}>🕐 {e.event_time}</div>}
                </div>
              </div>
            )
          })}
        </GlassPanel>
      )}

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Add House Event</div>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
          <input className="glass-input" placeholder="Event title (e.g. House party, Lease inspection)" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
          <input className="glass-input" placeholder="Details (optional)" value={description} onChange={e => setDescription(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>Date</label>
              <input type="date" className="glass-input" value={eventDate} onChange={e => setEventDate(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>Time (optional)</label>
              <input type="time" className="glass-input" value={eventTime} onChange={e => setEventTime(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-blue" onClick={addEvent}>Add Event</button>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          </div>
        </GlassPanel>
      )}

      {events.length === 0 && (
        <GlassPanel style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No events yet</div>
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Add house events — parties, inspections, lease renewal</div>
        </GlassPanel>
      )}

      {upcoming.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Upcoming</div>
          {upcoming.map(e => {
            const d = parseISO(e.event_date)
            const isToday = isSameDay(d, today)
            const daysUntil = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
            return (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{getEventIcon(e.title)}</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{e.title}</span>
                    {isToday && <span style={{ background: 'rgba(37,99,235,0.12)', color: '#2563EB', fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>TODAY</span>}
                  </div>
                  {e.description && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{e.description}</div>}
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 4 }}>
                    {format(d, 'EEEE, MMMM d, yyyy')}{e.event_time ? ` · ${e.event_time}` : ''}
                    {!isToday && daysUntil <= 30 && <span style={{ marginLeft: 8, color: '#D97706', fontWeight: 700 }}>in {daysUntil} day{daysUntil > 1 ? 's' : ''}</span>}
                    {' · by '}{e.profiles?.username}
                  </div>
                </div>
                {e.created_by === user?.id && (
                  <button onClick={() => deleteEvent(e.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, flexShrink: 0 }}>✕</button>
                )}
              </div>
            )
          })}
        </GlassPanel>
      )}

      {past.length > 0 && (
        <GlassPanel style={{ padding: 20, opacity: 0.7 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Past Events</div>
          {past.slice(0, 5).map(e => (
            <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 14, color: '#6B7280' }}>{getEventIcon(e.title)} {e.title}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{format(parseISO(e.event_date), 'MMM d, yyyy')}</div>
              </div>
              {e.created_by === user?.id && (
                <button onClick={() => deleteEvent(e.id)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.08)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>✕</button>
              )}
            </div>
          ))}
        </GlassPanel>
      )}
    </div>
  )
}
