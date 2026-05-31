import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'
import type { LockboxSecret } from '../types'

export default function Lockbox() {
  const { household } = useHousehold()
  const [items, setItems] = useState<LockboxSecret[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [value, setValue] = useState('')
  const [restricted, setRestricted] = useState(false)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`lockbox:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lockbox', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const { data } = await supabase.from('lockbox').select('*').eq('household_id', household.id)
    setItems((data ?? []) as LockboxSecret[])
  }

  async function addSecret() {
    if (!keyName.trim() || !value.trim() || !household) return
    await supabase.from('lockbox').insert({ household_id: household.id, key_name: keyName, value, is_restricted: restricted })
    setKeyName(''); setValue(''); setRestricted(false); setShowAdd(false); load()
  }

  async function deleteSecret(id: string) {
    await supabase.from('lockbox').delete().eq('id', id)
    load()
  }

  const toggle = (id: string) => setRevealed(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Lockbox</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Shared household secrets</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <input className="glass-input" placeholder="Key name (e.g. Wi-Fi Password)" value={keyName} onChange={e => setKeyName(e.target.value)} style={{ marginBottom: 12 }} />
          <input className="glass-input" placeholder="Value / secret" value={value} onChange={e => setValue(e.target.value)} style={{ marginBottom: 12 }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#2563EB' }} />
            Restrict (hide by default, require tap to reveal)
          </label>
          <button className="btn-blue" onClick={addSecret}>Save Secret</button>
        </GlassPanel>
      )}

      {items.map(item => {
        const hidden = item.is_restricted && !revealed.has(item.id)
        return (
          <GlassPanel key={item.id} style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 6 }}>{item.key_name}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 15, color: hidden ? '#D1D5DB' : '#111827', wordBreak: 'break-all' }}>
                  {hidden ? '•'.repeat(16) : item.value}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                {item.is_restricted && (
                  <button onClick={() => toggle(item.id)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(37,99,235,0.1)', color: '#1D4ED8', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    {hidden ? '👁 Reveal' : '🙈 Hide'}
                  </button>
                )}
                <button onClick={() => deleteSecret(item.id)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>✕</button>
              </div>
            </div>
          </GlassPanel>
        )
      })}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Lockbox is empty</div>
          <div style={{ fontSize: 14 }}>Add Wi-Fi passwords, alarm codes, and more</div>
        </div>
      )}
    </div>
  )
}
