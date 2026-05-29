import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'
import type { PetLog } from '../types'
import { format, startOfDay } from 'date-fns'

type PetAction = 'Morning Feed' | 'Evening Feed' | 'Daily Walk' | 'Medication Administered'
const ACTIONS: PetAction[] = ['Morning Feed', 'Evening Feed', 'Daily Walk', 'Medication Administered']
const ACTION_ICONS: Record<PetAction, string> = { 'Morning Feed': '🌅', 'Evening Feed': '🌙', 'Daily Walk': '🦮', 'Medication Administered': '💊' }

export default function Pets() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [logs, setLogs] = useState<PetLog[]>([])
  const [petNames, setPetNames] = useState<string[]>(['Buddy'])
  const [newPet, setNewPet] = useState('')

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`pets:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pet_logs' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household])

  async function load() {
    if (!household) return
    const today = startOfDay(new Date()).toISOString()
    const { data } = await supabase.from('pet_logs').select('*, profiles(username)').eq('household_id', household.id).gte('action_at', today).order('action_at', { ascending: false })
    const d = (data ?? []) as PetLog[]
    setLogs(d)
    // collect unique pet names
    const names = [...new Set(d.map(l => l.pet_name))]
    if (names.length) setPetNames(prev => [...new Set([...prev, ...names])])
  }

  async function logAction(petName: string, action: PetAction) {
    if (!household) return
    await supabase.from('pet_logs').insert({ household_id: household.id, pet_name: petName, action, done_by: user!.id })
    load()
  }

  function isDone(petName: string, action: PetAction) {
    return logs.find(l => l.pet_name === petName && l.action === action)
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Pet Care</h1>

      <GlassPanel style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input className="glass-input" placeholder="Add pet name" value={newPet} onChange={e => setNewPet(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && newPet.trim()) { setPetNames(prev => [...new Set([...prev, newPet.trim()])]); setNewPet('') } }} />
          <button onClick={() => { if (newPet.trim()) { setPetNames(prev => [...new Set([...prev, newPet.trim()])]); setNewPet('') } }} style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>Add</button>
        </div>
      </GlassPanel>

      {petNames.map(pet => (
        <GlassPanel key={pet} style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>🐾 {pet}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {ACTIONS.map(action => {
              const done = isDone(pet, action)
              return (
                <button key={action} onClick={() => !done && logAction(pet, action)} style={{ padding: '16px 12px', borderRadius: 16, border: done ? '1.5px solid rgba(16,185,129,0.4)' : '1.5px solid rgba(0,0,0,0.08)', background: done ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.6)', cursor: done ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s' }}>
                  <div style={{ fontSize: 24, marginBottom: 4 }}>{ACTION_ICONS[action]}</div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: done ? '#059669' : '#374151' }}>{action}</div>
                  {done ? (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                      {(done as any).profiles?.username} · {format(new Date(done.action_at), 'HH:mm')}
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Tap to log</div>
                  )}
                </button>
              )
            })}
          </div>
        </GlassPanel>
      ))}
    </div>
  )
}
