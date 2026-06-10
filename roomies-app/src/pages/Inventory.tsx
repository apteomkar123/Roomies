import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'

interface PantryItem {
  id: string
  item_name: string
  category: string | null
  quantity: number
  unit: string | null
  expiry_date: string | null
}

interface HouseholdItem {
  id: string
  name: string
  category: string
  quantity: number
  unit: string | null
  added_by: string
  created_at: string
  profiles?: { username: string }
}

const SUPPLY_CATEGORIES = ['Cleaning', 'Paper Goods', 'Toiletries', 'Laundry', 'Other']
const FOOD_CATEGORIES = ['Produce', 'Dairy', 'Meat', 'Pantry', 'Frozen', 'Beverages', 'Snacks', 'Other']

export default function Inventory() {
  const { user } = useAuth()
  const { household } = useHousehold()

  const [pantry, setPantry] = useState<PantryItem[]>([])
  const [supplies, setSupplies] = useState<HouseholdItem[]>([])
  const [pantryOpen, setPantryOpen] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addType, setAddType] = useState<'supply' | 'food'>('supply')
  const [itemName, setItemName] = useState('')
  const [category, setCategory] = useState('Other')
  const [qty, setQty] = useState('1')
  const [unit, setUnit] = useState('')
  const [expiryDate, setExpiryDate] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`inventory:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'household_inventory', filter: `household_id=eq.${household.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fridge_inventory', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const [{ data: pantryData }, { data: supplyData }] = await Promise.all([
      supabase.from('fridge_inventory').select('id,item_name,category,quantity,unit,expiry_date')
        .eq('household_id', household.id)
        .order('item_name', { ascending: true }),
      supabase.from('household_inventory').select('*, profiles!added_by(username)')
        .eq('household_id', household.id)
        .order('created_at', { ascending: false }),
    ])
    setPantry((pantryData ?? []) as PantryItem[])
    setSupplies((supplyData ?? []) as HouseholdItem[])
  }

  async function addItem() {
    if (!itemName.trim() || !household || !user) return
    setSaveError(null)
    const { error } = await supabase.from('household_inventory').insert({
      household_id: household.id,
      added_by: user.id,
      name: itemName.trim(),
      category,
      quantity: parseFloat(qty) || 1,
      unit: unit.trim() || null,
    })
    if (error) { setSaveError(error.message); return }
    setItemName(''); setQty('1'); setUnit(''); setShowAdd(false); load()
  }

  async function addFoodItem() {
    if (!itemName.trim() || !household || !user) return
    setSaveError(null)
    const { error } = await supabase.from('fridge_inventory').insert({
      user_id: user.id,
      household_id: household.id,
      item_name: itemName.trim(),
      category: category || null,
      quantity: parseFloat(qty) || 1,
      unit: unit.trim() || null,
      expiry_date: expiryDate || null,
      is_household: true,
    })
    if (error) { setSaveError(error.message); return }
    setItemName(''); setQty('1'); setUnit(''); setExpiryDate(''); setShowAdd(false); load()
  }

  async function deleteItem(id: string) {
    await supabase.from('household_inventory').delete().eq('id', id)
    load()
  }

  const CATEGORY_EMOJI: Record<string, string> = {
    'Cleaning': '🧹', 'Paper Goods': '🧻', 'Toiletries': '🧴', 'Laundry': '👕', 'Other': '📦'
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Inventory</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Pantry &amp; household supplies</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
          {/* Type toggle */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, background: 'rgba(0,0,0,0.04)', borderRadius: 12, padding: 4 }}>
            {(['supply', 'food'] as const).map(t => (
              <button key={t} onClick={() => { setAddType(t); setCategory(t === 'food' ? 'Other' : 'Other'); setSaveError(null) }}
                style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  background: addType === t ? 'white' : 'transparent',
                  color: addType === t ? '#2563EB' : '#6B7280',
                  boxShadow: addType === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                {t === 'supply' ? '🏠 Supply' : '🥦 Food Item'}
              </button>
            ))}
          </div>
          <input className="glass-input" placeholder={addType === 'food' ? 'Item name (e.g. Milk)' : 'Item name (e.g. Swiffer pads)'} value={itemName} onChange={e => setItemName(e.target.value)} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            <input className="glass-input" placeholder="Qty" value={qty} onChange={e => setQty(e.target.value)} style={{ width: 80 }} />
            <input className="glass-input" placeholder="Unit (e.g. liters)" value={unit} onChange={e => setUnit(e.target.value)} style={{ flex: 1 }} />
          </div>
          <select value={category} onChange={e => setCategory(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: addType === 'food' ? 12 : 14, fontFamily: 'inherit' }}>
            {(addType === 'food' ? FOOD_CATEGORIES : SUPPLY_CATEGORIES).map(c => <option key={c}>{c}</option>)}
          </select>
          {addType === 'food' && (
            <input type="date" className="glass-input" placeholder="Expiry date (optional)" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} style={{ marginBottom: 14 }} />
          )}
          <button className="btn-blue" onClick={addType === 'food' ? addFoodItem : addItem}>
            Add {addType === 'food' ? 'Food Item' : 'Supply'}
          </button>
        </GlassPanel>
      )}

      {/* Pantry from Pantry */}
      <GlassPanel id="tut-inventory" style={{ padding: 20, marginBottom: 20 }}>
        <button
          onClick={() => setPantryOpen(v => !v)}
          style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}
        >
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>🥦 Food Items (synced from Pantry)</div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{pantry.length} items</div>
          </div>
          <span style={{ fontSize: 18, color: '#9CA3AF', transform: pantryOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.2s' }}>▾</span>
        </button>
        {pantryOpen && (
          <div style={{ marginTop: 14 }}>
            {pantry.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 14 }}>No food items yet. Add food in the Pantry app to see it here.</div>}
            {pantry.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{item.item_name}</div>
                  {item.category && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{item.category}</div>}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: '#374151' }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</div>
                  {item.expiry_date && (
                    <div style={{ fontSize: 11, color: new Date(item.expiry_date) < new Date() ? '#E11D48' : '#9CA3AF' }}>
                      exp {item.expiry_date}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {/* Household supplies */}
      <GlassPanel style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>🏠 Household Supplies</div>
        {supplies.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 14 }}>No supplies tracked yet. Add swiffer pads, paper towels, and more.</div>}
        {SUPPLY_CATEGORIES.map(cat => {
          const catItems = supplies.filter(s => s.category === cat)
          if (catItems.length === 0) return null
          return (
            <div key={cat} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>{CATEGORY_EMOJI[cat] ?? '📦'} {cat}</div>
              {catItems.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: '#9CA3AF' }}>by {item.profiles?.username}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{item.quantity}{item.unit ? ` ${item.unit}` : ''}</span>
                    {item.added_by === user?.id && (
                      <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#D1D5DB', cursor: 'pointer', fontSize: 14 }}>✕</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </GlassPanel>
    </div>
  )
}
