import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { ShoppingItem } from '../types'

export default function Shopping() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [items, setItems] = useState<ShoppingItem[]>([])
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('1')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`shopping:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const { data } = await supabase.from('shopping_items').select('*, profiles(username)').eq('household_id', household.id).order('urgent', { ascending: false }).order('created_at', { ascending: false })
    setItems((data ?? []) as ShoppingItem[])
  }

  async function addItem() {
    if (!title.trim() || !household) return
    await supabase.from('shopping_items').insert({ household_id: household.id, added_by: user!.id, title: title.trim(), quantity: qty, urgent })
    // Sync with Hungry
    supabase.from('cross_app_activity').insert({
      user_id: user!.id,
      app: 'roomies',
      activity_type: 'shopping_item_added',
      is_public: false,
      payload: { household_id: household.id, item: title.trim(), quantity: qty, urgent },
    }).then(() => {})
    setTitle(''); setQty('1'); setUrgent(false); load()
  }

  async function togglePurchased(id: string, current: boolean) {
    await supabase.from('shopping_items').update({ purchased: !current }).eq('id', id)
    load()
  }

  async function deleteItem(id: string) {
    await supabase.from('shopping_items').delete().eq('id', id)
    load()
  }

  const pending = items.filter(i => !i.purchased)
  const done = items.filter(i => i.purchased)

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />


      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Shopping List</h1>

      <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
          <input className="glass-input" placeholder="Add item…" value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} style={{ flex: 1 }} />
          <input className="glass-input" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} style={{ width: 70 }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={urgent} onChange={e => setUrgent(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#F43F5E' }} />
            <span style={{ color: urgent ? '#E11D48' : '#6B7280' }}>Urgent</span>
          </label>
          <button onClick={addItem} style={{ padding: '10px 20px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Add</button>
        </div>
      </GlassPanel>

      {pending.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          {pending.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <input type="checkbox" checked={false} onChange={() => togglePurchased(item.id, false)} style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.urgent && <span style={{ background: 'rgba(244,63,94,0.1)', color: '#E11D48', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>URGENT</span>}
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</span>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}>×{item.quantity}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF' }}>by {item.profiles?.username}</div>
              </div>
              <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
          ))}
        </GlassPanel>
      )}

      {done.length > 0 && (
        <GlassPanel style={{ padding: 20, opacity: 0.6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Purchased</div>
          {done.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <input type="checkbox" checked onChange={() => togglePurchased(item.id, true)} style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer' }} />
              <span style={{ fontWeight: 600, fontSize: 14, textDecoration: 'line-through', color: '#9CA3AF' }}>{item.title}</span>
              <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 14, marginLeft: 'auto' }}>✕</button>
            </div>
          ))}
        </GlassPanel>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>List is empty</div>
        </div>
      )}
    </div>
  )
}
