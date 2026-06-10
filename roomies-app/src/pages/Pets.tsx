import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { PetLog } from '../types'
import { format, startOfDay } from 'date-fns'

const STANDARD_ACTIONS = ['Morning Feed', 'Evening Feed', 'Daily Walk', 'Medication Administered'] as const
const ACTION_ICONS: Record<string, string> = {
  'Morning Feed': '🌅',
  'Evening Feed': '🌙',
  'Daily Walk': '🦮',
  'Medication Administered': '💊',
}

export default function Pets() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [logs, setLogs] = useState<PetLog[]>([])
  const [petNames, setPetNames] = useState<string[]>([])
  const [newPet, setNewPet] = useState('')
  const [customChores, setCustomChores] = useState<Record<string, string[]>>({})
  const [newChoreInputs, setNewChoreInputs] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!household) return
    const stored = localStorage.getItem(`pet-chores-${household.id}`)
    if (stored) setCustomChores(JSON.parse(stored))
    const storedPets = localStorage.getItem(`pet-names-${household.id}`)
    if (storedPets) setPetNames(JSON.parse(storedPets))
    load()
    const ch = supabase.channel(`pets:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pet_logs' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const today = startOfDay(new Date()).toISOString()
    const [{ data }, { data: allNameData }] = await Promise.all([
      supabase.from('pet_logs').select('*, profiles(username)').eq('household_id', household.id).gte('action_at', today).order('action_at', { ascending: false }),
      supabase.from('pet_logs').select('pet_name').eq('household_id', household.id),
    ])
    const d = (data ?? []) as PetLog[]
    setLogs(d)
    const namesFromDB = [...new Set((allNameData ?? []).map((l: { pet_name: string }) => l.pet_name))]
    if (namesFromDB.length) {
      setPetNames(prev => {
        const merged = [...new Set([...prev, ...namesFromDB])]
        if (household) localStorage.setItem(`pet-names-${household.id}`, JSON.stringify(merged))
        return merged
      })
    }
  }

  async function logAction(petName: string, action: string) {
    if (!household) return
    await supabase.from('pet_logs').insert({ household_id: household.id, pet_name: petName, action, done_by: user!.id })
    load()
  }

  async function unlogAction(logId: string) {
    await supabase.from('pet_logs').delete().eq('id', logId)
    load()
  }

  function getLog(petName: string, action: string) {
    return logs.find(l => l.pet_name === petName && l.action === action)
  }

  function addPet() {
    if (!newPet.trim() || !household) return
    const updated = [...new Set([...petNames, newPet.trim()])]
    setPetNames(updated)
    localStorage.setItem(`pet-names-${household.id}`, JSON.stringify(updated))
    setNewPet('')
  }

  function deletePet(name: string) {
    if (!household) return
    const updated = petNames.filter(p => p !== name)
    setPetNames(updated)
    localStorage.setItem(`pet-names-${household.id}`, JSON.stringify(updated))
    const updatedChores = { ...customChores }
    delete updatedChores[name]
    setCustomChores(updatedChores)
    localStorage.setItem(`pet-chores-${household.id}`, JSON.stringify(updatedChores))
  }

  function addCustomChore(petName: string) {
    const chore = (newChoreInputs[petName] ?? '').trim()
    if (!chore || !household) return
    const updated = { ...customChores, [petName]: [...(customChores[petName] ?? []), chore] }
    setCustomChores(updated)
    localStorage.setItem(`pet-chores-${household.id}`, JSON.stringify(updated))
    setNewChoreInputs(prev => ({ ...prev, [petName]: '' }))
  }

  function removeCustomChore(petName: string, chore: string) {
    if (!household) return
    const updated = { ...customChores, [petName]: (customChores[petName] ?? []).filter(c => c !== chore) }
    setCustomChores(updated)
    localStorage.setItem(`pet-chores-${household.id}`, JSON.stringify(updated))
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Pet Care</h1>

      <GlassPanel id="tut-pets" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            className="glass-input"
            placeholder="Add pet name"
            value={newPet}
            onChange={e => setNewPet(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addPet()}
          />
          <button
            onClick={addPet}
            style={{ padding: '12px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}
          >
            Add
          </button>
        </div>
      </GlassPanel>

      {petNames.map(pet => {
        const petCustomChores = customChores[pet] ?? []
        const allActions = [...STANDARD_ACTIONS, ...petCustomChores]
        return (
          <GlassPanel key={pet} style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontWeight: 800, fontSize: 20 }}>🐾 {pet}</div>
              <button
                onClick={() => deletePet(pet)}
                style={{ padding: '6px 12px', borderRadius: 10, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}
              >
                Remove Pet
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {allActions.map(action => {
                const done = getLog(pet, action)
                const isMyLog = done?.done_by === user?.id
                const icon = ACTION_ICONS[action] ?? '✔️'
                return (
                  <button
                    key={action}
                    onClick={() => {
                      if (done) {
                        if (isMyLog) unlogAction(done.id)
                      } else {
                        logAction(pet, action)
                      }
                    }}
                    style={{ padding: '16px 12px', borderRadius: 16, border: done ? '1.5px solid rgba(16,185,129,0.4)' : '1.5px solid rgba(0,0,0,0.08)', background: done ? 'rgba(16,185,129,0.1)' : 'rgba(255,255,255,0.6)', cursor: done && !isMyLog ? 'default' : 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s', position: 'relative' }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{icon}</div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: done ? '#059669' : '#374151' }}>{action}</div>
                    {done ? (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>
                        {done.profiles?.username} · {format(new Date(done.action_at), 'h:mm a')}
                        {isMyLog && <span style={{ color: '#E11D48', marginLeft: 4 }}>· tap to undo</span>}
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>Tap to log</div>
                    )}
                    {petCustomChores.includes(action) && (
                      <button onClick={e => { e.stopPropagation(); removeCustomChore(pet, action) }} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
                    )}
                  </button>
                )
              })}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="glass-input"
                placeholder="Add pet-specific chore (e.g. Grooming)"
                value={newChoreInputs[pet] ?? ''}
                onChange={e => setNewChoreInputs(prev => ({ ...prev, [pet]: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && addCustomChore(pet)}
                style={{ fontSize: 13 }}
              />
              <button onClick={() => addCustomChore(pet)} style={{ padding: '10px 14px', borderRadius: 10, border: 'none', background: 'rgba(37,99,235,0.1)', color: '#2563EB', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', fontSize: 13 }}>
                + Add
              </button>
            </div>
          </GlassPanel>
        )
      })}

      {petNames.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🐾</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No pets yet</div>
          <div style={{ fontSize: 14 }}>Add your first pet above</div>
        </div>
      )}
    </div>
  )
}
