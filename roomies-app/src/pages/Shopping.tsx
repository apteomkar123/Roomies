import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { ShoppingItem } from '../types'

// All shopping items (whether added in HomeBase or Pantry) now live in shopping_list.
// We keep _source only to detect items that were written before Session 23 (shopping_items table).
type CombinedItem = ShoppingItem & {
  note?: string | null
  _source?: 'legacy_homebase'
  _legacy_id?: string
}

export default function Shopping() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [items, setItems] = useState<CombinedItem[]>([])
  const [title, setTitle] = useState('')
  const [qty, setQty] = useState('1')
  const [urgent, setUrgent] = useState(false)
  const [addError, setAddError] = useState<string | null>(null)
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null)
  const [noteInput, setNoteInput] = useState('')
  const noteRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!household) return
    load()
    // Subscribe to both tables for real-time updates
    const ch = supabase.channel(`shopping:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `household_id=eq.${household.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_list', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return

    // All items (both Pantry-added and HomeBase-added) live in shopping_list since Session 23.
    const { data: listData } = await supabase
      .from('shopping_list')
      .select('*, profiles!user_id(username)')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })

    const unified: CombinedItem[] = (listData || []).map(item => ({
      id: item.id,
      household_id: item.household_id,
      added_by: item.user_id,
      title: item.item_name,
      quantity: String(item.quantity ?? '1'),
      urgent: item.is_urgent || false,
      purchased: item.is_completed || false,
      note: item.note ?? null,
      created_at: item.created_at,
      profiles: { username: (item.profiles as any)?.username ?? 'Member' } as any,
    }))

    // Legacy fallback: items that were added via shopping_items before Session 23.
    const { data: legacyData } = await supabase
      .from('shopping_items')
      .select('*, profiles(username)')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })

    const legacy: CombinedItem[] = (legacyData || []).map(item => ({
      id: `legacy_${item.id}`,
      household_id: item.household_id,
      added_by: item.added_by,
      title: item.title,
      quantity: String(item.quantity ?? '1'),
      urgent: item.urgent || false,
      purchased: item.purchased || false,
      note: null,
      created_at: item.created_at,
      profiles: { username: (item.profiles as any)?.username ?? 'Member' } as any,
      _source: 'legacy_homebase' as const,
      _legacy_id: item.id,
    }))

    // Deduplicate by title in case a legacy item was re-added to shopping_list
    const unifiedTitles = new Set(unified.map(i => i.title?.toLowerCase()))
    const filteredLegacy = legacy.filter(i => !unifiedTitles.has(i.title?.toLowerCase()))

    setItems([...unified, ...filteredLegacy])
  }

  async function addItem() {
    if (!title.trim() || !household) return
    setAddError(null)
    const { error } = await supabase.from('shopping_list').insert({
      user_id: user!.id,
      household_id: household.id,
      item_name: title.trim(),
      quantity: parseInt(qty) || 1,
      is_urgent: urgent,
      is_completed: false,
    })
    if (error) { setAddError(error.message); return }
    supabase.from('cross_app_activity').insert({
      user_id: user!.id,
      app: 'homebase',
      activity_type: 'shopping_item_added',
      is_public: false,
      payload: { household_id: household.id, item: title.trim(), quantity: qty, urgent },
    }).then(() => {})
    setTitle(''); setQty('1'); setUrgent(false); load()
  }

  async function togglePurchased(item: CombinedItem) {
    if (item._source === 'legacy_homebase') {
      await supabase.from('shopping_items').update({ purchased: !item.purchased }).eq('id', item._legacy_id!)
    } else {
      await supabase.from('shopping_list').update({ is_completed: !item.purchased }).eq('id', item.id)
    }
    load()
  }

  async function deleteItem(item: CombinedItem) {
    if (item._source === 'legacy_homebase') {
      await supabase.from('shopping_items').delete().eq('id', item._legacy_id!)
    } else {
      await supabase.from('shopping_list').delete().eq('id', item.id)
    }
    load()
  }

  function startNoteEditing(item: CombinedItem) {
    setNoteEditingId(item.id)
    setNoteInput(item.note || '')
    setTimeout(() => noteRef.current?.focus(), 0)
  }

  async function commitNote(item: CombinedItem) {
    const trimmed = noteInput.trim()
    if (item._source !== 'legacy_homebase') {
      await supabase.from('shopping_list').update({ note: trimmed || null }).eq('id', item.id)
    }
    setNoteEditingId(null)
    load()
  }

  const pending = items.filter(i => !i.purchased)
  const done = items.filter(i => i.purchased)

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Shopping List</h1>

      <GlassPanel id="tut-shopping" style={{ padding: 20, marginBottom: 20 }}>
        {addError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{addError}</div>}
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
            <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={false} onChange={() => togglePurchased(item)} style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.urgent && <span style={{ background: 'rgba(244,63,94,0.1)', color: '#E11D48', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>URGENT</span>}
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</span>
                    <span style={{ fontSize: 12, color: '#9CA3AF' }}>×{item.quantity}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>by {item.profiles?.username}</div>
                </div>
                {/* Note button — only for shopping_list rows */}
                {!item._source && (
                  <button
                    onClick={() => startNoteEditing(item)}
                    title={item.note ? 'Edit note' : 'Add note'}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: item.note ? '#F59E0B' : '#D1D5DB', padding: '4px' }}
                  >💬</button>
                )}
                <button onClick={() => deleteItem(item)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
              {/* Inline note editor */}
              {noteEditingId === item.id && (
                <div style={{ marginTop: 8, paddingLeft: 30 }}>
                  <input
                    ref={noteRef}
                    value={noteInput}
                    onChange={e => setNoteInput(e.target.value)}
                    onBlur={() => commitNote(item)}
                    onKeyDown={e => { if (e.key === 'Enter') commitNote(item); if (e.key === 'Escape') setNoteEditingId(null); }}
                    placeholder="Add a note…"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 10, border: '1px solid #FCD34D', background: '#FFFBEB', fontSize: 13, color: '#78350F', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                  />
                </div>
              )}
              {/* Display existing note */}
              {item.note && noteEditingId !== item.id && (
                <div
                  onClick={() => startNoteEditing(item)}
                  style={{ marginTop: 4, paddingLeft: 30, fontSize: 12, color: '#B45309', fontStyle: 'italic', cursor: 'pointer' }}
                >
                  💬 {item.note}
                </div>
              )}
            </div>
          ))}
        </GlassPanel>
      )}

      {done.length > 0 && (
        <GlassPanel style={{ padding: 20, opacity: 0.6 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Purchased</div>
          {done.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <input type="checkbox" checked onChange={() => togglePurchased(item)} style={{ width: 18, height: 18, accentColor: '#10B981', cursor: 'pointer' }} />
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontWeight: 600, fontSize: 14, textDecoration: 'line-through', color: '#9CA3AF' }}>{item.title}</span>
              </div>
              <button onClick={() => deleteItem(item)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 14, marginLeft: 'auto' }}>✕</button>
            </div>
          ))}
        </GlassPanel>
      )}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>List is empty</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Items added in Pantry appear here too</div>
        </div>
      )}
    </div>
  )
}
