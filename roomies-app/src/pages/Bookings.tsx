import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { Booking } from '../types'
import { format, isSameDay, addDays, startOfDay } from 'date-fns'

function fmt12(h: number) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 || 12
  return `${hr}:00 ${ampm}`
}

export default function Bookings() {
  const { user } = useAuth()
  const { household, memberProfiles } = useHousehold()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [resources, setResources] = useState<string[]>([])
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [showAdd, setShowAdd] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [newResourceName, setNewResourceName] = useState('')
  const [resource, setResource] = useState('')
  const [startHour, setStartHour] = useState(8)
  const [endHour, setEndHour] = useState(9)

  const profileColorMap = Object.fromEntries(memberProfiles.map((p, i) => [p.id, ['#2563EB','#10B981','#8B5CF6','#F59E0B','#F43F5E'][i % 5]]))
  const profileMap = Object.fromEntries(memberProfiles.map(p => [p.id, p.username]))

  useEffect(() => {
    if (!household) return
    loadResources()
    load()
    const ch = supabase.channel(`bookings:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadResources() {
    if (!household) return
    const { data } = await supabase
      .from('household_resources')
      .select('name')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true })
    const names = (data ?? []).map((r: { name: string }) => r.name)
    setResources(names)
    if (names.length) setResource(prev => prev || names[0])
  }

  async function load() {
    if (!household) return
    const { data } = await supabase.from('bookings').select('*, profiles(username)').eq('household_id', household.id)
    setBookings((data ?? []) as Booking[])
  }

  async function addResource() {
    if (!household || !newResourceName.trim()) return
    await supabase.from('household_resources').insert({ household_id: household.id, name: newResourceName.trim() })
    setNewResourceName('')
    await loadResources()
  }

  async function removeResource(name: string) {
    if (!household) return
    await supabase.from('household_resources').delete().eq('household_id', household.id).eq('name', name)
    await loadResources()
  }

  async function addBooking() {
    if (!household || !resource || endHour <= startHour) return
    const base = startOfDay(selectedDay)
    const start = new Date(base); start.setHours(startHour)
    const end = new Date(base); end.setHours(endHour)
    await supabase.from('bookings').insert({ household_id: household.id, booked_by: user!.id, resource_name: resource, start_time: start.toISOString(), end_time: end.toISOString() })
    setShowAdd(false); load()
  }

  async function deleteBooking(id: string) {
    await supabase.from('bookings').delete().eq('id', id)
    load()
  }

  function openBookingForm(res: string, h: number) {
    setResource(res)
    setStartHour(h)
    setEndHour(h + 1)
    setShowAdd(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const dayBookings = bookings.filter(b => isSameDay(new Date(b.start_time), selectedDay))
  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i))
  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Bookings</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Common area reservations</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShowManage(!showManage)}
            style={{ background: 'rgba(255,255,255,0.6)', color: '#374151', border: '1.5px solid rgba(200,210,230,0.5)', borderRadius: 14, padding: '10px 14px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
          >
            Manage
          </button>
          <button
            onClick={() => { if (resources.length) setShowAdd(!showAdd) }}
            disabled={resources.length === 0}
            style={{ background: resources.length ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : '#D1D5DB', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: resources.length ? 'pointer' : 'default', fontFamily: 'inherit' }}
          >
            + Book
          </button>
        </div>
      </div>

      {/* Manage resources panel */}
      {showManage && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Shared Resources</div>
          {resources.length === 0 && (
            <p style={{ color: '#9CA3AF', fontSize: 13, margin: '0 0 12px' }}>No resources yet. Add your first one below.</p>
          )}
          {resources.map(r => (
            <div key={r} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{r}</span>
              <button onClick={() => removeResource(r)} style={{ background: 'none', border: 'none', color: '#F43F5E', cursor: 'pointer', fontWeight: 700, fontSize: 13, padding: '4px 8px' }}>Remove</button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <input
              value={newResourceName}
              onChange={e => setNewResourceName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addResource()}
              placeholder="e.g. Washing Machine"
              style={{ flex: 1, padding: '10px 14px', borderRadius: 10, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'inherit' }}
            />
            <button onClick={addResource} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
          </div>
        </GlassPanel>
      )}

      {/* Day selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4 }}>
        {days.map(d => (
          <button key={d.toISOString()} onClick={() => setSelectedDay(d)} style={{ padding: '10px 14px', borderRadius: 14, border: 'none', cursor: 'pointer', fontFamily: 'inherit', minWidth: 56, background: isSameDay(d, selectedDay) ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(255,255,255,0.6)', color: isSameDay(d, selectedDay) ? 'white' : '#374151', fontWeight: 700, boxShadow: isSameDay(d, selectedDay) ? '0 4px 16px rgba(37,99,235,0.3)' : undefined }}>
            <div style={{ fontSize: 11, opacity: 0.8 }}>{format(d, 'EEE')}</div>
            <div style={{ fontSize: 18 }}>{format(d, 'd')}</div>
          </button>
        ))}
      </div>

      {/* Booking form */}
      {showAdd && (
        <GlassPanel id="tut-appliance" style={{ padding: 20, marginBottom: 20 }}>
          <select value={resource} onChange={e => setResource(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}>
            {resources.map(r => <option key={r}>{r}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Start</label>
              <select value={startHour} onChange={e => { const h = +e.target.value; setStartHour(h); if (endHour <= h) setEndHour(h + 1) }} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontFamily: 'inherit' }}>
                {hours.map(h => <option key={h} value={h}>{fmt12(h)}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>End</label>
              <select value={endHour} onChange={e => setEndHour(+e.target.value)} style={{ width: '100%', padding: '10px', borderRadius: 10, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontFamily: 'inherit' }}>
                {hours.filter(h => h > startHour).map(h => <option key={h} value={h}>{h.toString().padStart(2,'0')}:00</option>)}
              </select>
            </div>
          </div>
          <button className="btn-blue" onClick={addBooking}>Reserve Slot</button>
        </GlassPanel>
      )}

      {/* Empty state */}
      {resources.length === 0 && (
        <GlassPanel style={{ padding: 32, textAlign: 'center' as const }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No shared resources yet</div>
          <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 16 }}>Add the resources your household shares — laundry, parking, BBQ, etc.</div>
          <button onClick={() => setShowManage(true)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 12, padding: '10px 22px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Add First Resource
          </button>
        </GlassPanel>
      )}

      {/* Timeline grid */}
      {resources.map(res => {
        const resBookings = dayBookings.filter(b => b.resource_name === res)
        return (
          <GlassPanel key={res} style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{res}</div>
            <div style={{ display: 'flex', gap: 2 }}>
              {Array.from({ length: 18 }, (_, i) => i + 6).map(h => {
                const booking = resBookings.find(b => {
                  const s = new Date(b.start_time).getHours()
                  const e = new Date(b.end_time).getHours()
                  return h >= s && h < e
                })
                const color = booking ? profileColorMap[booking.booked_by] ?? '#2563EB' : undefined
                const isMe = booking?.booked_by === user?.id
                return (
                  <div
                    key={h}
                    title={
                      booking
                        ? `${profileMap[booking.booked_by] ?? 'Someone'} (${fmt12(h)}–${fmt12(h + 1)})${isMe ? '\nClick to cancel' : ''}`
                        : `Book ${res} at ${fmt12(h)}`
                    }
                    onClick={() => booking ? (isMe && deleteBooking(booking.id)) : openBookingForm(res, h)}
                    onMouseEnter={e => { if (!booking) (e.currentTarget as HTMLDivElement).style.background = 'rgba(37,99,235,0.14)' }}
                    onMouseLeave={e => { if (!booking) (e.currentTarget as HTMLDivElement).style.background = 'rgba(0,0,0,0.06)' }}
                    style={{
                      flex: 1, height: 28, borderRadius: 6,
                      background: color ? color + '30' : 'rgba(0,0,0,0.06)',
                      border: `1.5px solid ${color ?? 'rgba(200,210,230,0.4)'}`,
                      cursor: booking ? (isMe ? 'pointer' : 'default') : 'pointer',
                      position: 'relative', transition: 'background 0.12s',
                    }}
                  >
                    {h % 3 === 0 && (
                      <span style={{ position: 'absolute', bottom: -16, left: '50%', transform: 'translateX(-50%)', fontSize: 9, color: '#9CA3AF', fontWeight: 600 }}>
                        {h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            <div style={{ height: 16 }} />
          </GlassPanel>
        )
      })}
    </div>
  )
}
