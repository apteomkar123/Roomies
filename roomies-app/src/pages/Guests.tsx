import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { GuestLog } from '../types'
import { format, differenceInDays } from 'date-fns'

export default function Guests() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [logs, setLogs] = useState<GuestLog[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [guestName, setGuestName] = useState('')
  const [arrival, setArrival] = useState('')
  const [departure, setDeparture] = useState('')

  useEffect(() => {
    if (!household) return
    loadAll()
    const ch = supabase.channel(`guests:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'guest_logs', filter: `household_id=eq.${household.id}` }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    if (!household) return
    const { data: g } = await supabase
      .from('guest_logs')
      .select('*, profiles(username)')
      .eq('household_id', household.id)
      .order('arrival_date', { ascending: false })
    setLogs((g ?? []) as GuestLog[])
  }

  async function addLog() {
    if (!guestName.trim() || !arrival || !departure || !household) return
    if (departure <= arrival) return
    await supabase.from('guest_logs').insert({ household_id: household.id, host_id: user!.id, guest_name: guestName, arrival_date: arrival, departure_date: departure })
    setGuestName(''); setArrival(''); setDeparture(''); setShowAdd(false); loadAll()
  }

  async function deleteLog(id: string) {
    await supabase.from('guest_logs').delete().eq('id', id)
    loadAll()
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Guests</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Guest visit log</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Log Guest
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <input className="glass-input" placeholder="Guest name" value={guestName} onChange={e => setGuestName(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Arrival</label>
              <input type="date" value={arrival} onChange={e => setArrival(e.target.value)} className="glass-input" />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', display: 'block', marginBottom: 6 }}>Departure</label>
              <input type="date" value={departure} onChange={e => setDeparture(e.target.value)} className="glass-input" />
            </div>
          </div>
          <button className="btn-blue" onClick={addLog}>Log Guest</button>
        </GlassPanel>
      )}

      {logs.map(log => {
        const nights = differenceInDays(new Date(log.departure_date), new Date(log.arrival_date))
        return (
          <GlassPanel key={log.id} style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{log.guest_name}</div>
                <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 2 }}>
                  {format(new Date(log.arrival_date), 'MMM d')} → {format(new Date(log.departure_date), 'MMM d')} · {nights} night{nights !== 1 ? 's' : ''}
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Host: {log.profiles?.username}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {log.host_id === user?.id && (
                  <button onClick={() => deleteLog(log.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
                )}
              </div>
            </div>
          </GlassPanel>
        )
      })}

      {logs.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No guests logged</div>
        </div>
      )}
    </div>
  )
}
