import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { MoveInRoom, MoveInItem } from '../types'
import { format } from 'date-fns'

const CONDITIONS = ['Excellent', 'Good', 'Fair', 'Poor', 'Damaged']
const CONDITION_COLOR: Record<string, string> = {
  'Excellent': '#059669', 'Good': '#2563EB', 'Fair': '#D97706',
  'Poor': '#DC2626', 'Damaged': '#7C3AED',
}
const CONDITION_BG: Record<string, string> = {
  'Excellent': 'rgba(16,185,129,0.1)', 'Good': 'rgba(37,99,235,0.1)',
  'Fair': 'rgba(245,158,11,0.1)', 'Poor': 'rgba(239,68,68,0.1)',
  'Damaged': 'rgba(139,92,246,0.1)',
}

type RoomWithItems = MoveInRoom & { items: MoveInItem[] }

export default function MoveIn() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [rooms, setRooms] = useState<RoomWithItems[]>([])
  const [expandedRoom, setExpandedRoom] = useState<string | null>(null)
  const [showAddRoom, setShowAddRoom] = useState(false)
  const [roomName, setRoomName] = useState('')
  const [addingItemToRoom, setAddingItemToRoom] = useState<string | null>(null)
  const [itemName, setItemName] = useState('')
  const [itemCondition, setItemCondition] = useState('Good')
  const [itemNotes, setItemNotes] = useState('')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`movein:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'move_in_rooms', filter: `household_id=eq.${household.id}` }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'move_in_items', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const [{ data: roomData }, { data: itemData }] = await Promise.all([
      supabase.from('move_in_rooms').select('*').eq('household_id', household.id).order('created_at'),
      supabase.from('move_in_items').select('*, profiles!logged_by(username)').eq('household_id', household.id).order('logged_at'),
    ])
    const roomList = (roomData ?? []) as MoveInRoom[]
    const itemList = (itemData ?? []) as MoveInItem[]
    setRooms(roomList.map(r => ({ ...r, items: itemList.filter(i => i.room_id === r.id) })))
  }

  async function addRoom() {
    if (!roomName.trim() || !household) return
    setSaveError(null)
    const { error } = await supabase.from('move_in_rooms').insert({
      household_id: household.id,
      created_by: user!.id,
      room_name: roomName.trim(),
    })
    if (error) { setSaveError(error.message); return }
    setRoomName(''); setShowAddRoom(false)
    load()
  }

  async function addItem(roomId: string) {
    if (!itemName.trim() || !household) return
    setSaveError(null)
    const { error } = await supabase.from('move_in_items').insert({
      room_id: roomId,
      household_id: household.id,
      item_name: itemName.trim(),
      condition: itemCondition,
      notes: itemNotes.trim() || null,
      logged_by: user!.id,
    })
    if (error) { setSaveError(error.message); return }
    setItemName(''); setItemNotes(''); setItemCondition('Good'); setAddingItemToRoom(null)
    load()
  }

  async function deleteItem(id: string) {
    await supabase.from('move_in_items').delete().eq('id', id)
    load()
  }

  async function deleteRoom(id: string) {
    await supabase.from('move_in_rooms').delete().eq('id', id)
    load()
  }

  const totalItems = rooms.reduce((s, r) => s + r.items.length, 0)
  const damagedItems = rooms.reduce((s, r) => s + r.items.filter(i => i.condition === 'Damaged' || i.condition === 'Poor').length, 0)

  return (
    <div id="tut-movein" style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Move-In Checklist</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Document property condition</div>
        </div>
        <button onClick={() => setShowAddRoom(true)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add Room
        </button>
      </div>

      {/* Summary */}
      {totalItems > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <GlassPanel style={{ padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#2563EB' }}>{totalItems}</div>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Items logged</div>
          </GlassPanel>
          <GlassPanel style={{ padding: 16, textAlign: 'center', background: damagedItems > 0 ? 'rgba(239,68,68,0.05)' : undefined }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: damagedItems > 0 ? '#DC2626' : '#059669' }}>{damagedItems}</div>
            <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 600 }}>Issues noted</div>
          </GlassPanel>
        </div>
      )}

      {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{saveError}</div>}

      {showAddRoom && (
        <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Add Room</div>
          <input className="glass-input" placeholder="Room name (e.g. Master Bedroom, Kitchen, Bathroom)" value={roomName} onChange={e => setRoomName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addRoom()} style={{ marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-blue" onClick={addRoom}>Add Room</button>
            <button onClick={() => setShowAddRoom(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          </div>
        </GlassPanel>
      )}

      {rooms.length === 0 && !showAddRoom && (
        <GlassPanel style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏠</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No rooms added yet</div>
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Add each room and document its condition at move-in. Use this for deposit disputes at move-out.</div>
        </GlassPanel>
      )}

      {rooms.map(room => (
        <GlassPanel key={room.id} style={{ padding: 0, marginBottom: 16, overflow: 'hidden' }}>
          {/* Room header */}
          <div
            onClick={() => setExpandedRoom(expandedRoom === room.id ? null : room.id)}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer', borderBottom: expandedRoom === room.id ? '1px solid rgba(0,0,0,0.08)' : 'none' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🚪</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{room.room_name}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>{room.items.length} item{room.items.length !== 1 ? 's' : ''} logged</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {room.items.filter(i => i.condition === 'Damaged' || i.condition === 'Poor').length > 0 && (
                <span style={{ background: 'rgba(239,68,68,0.1)', color: '#DC2626', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>
                  {room.items.filter(i => i.condition === 'Damaged' || i.condition === 'Poor').length} issue{room.items.filter(i => i.condition === 'Damaged' || i.condition === 'Poor').length > 1 ? 's' : ''}
                </span>
              )}
              <span style={{ color: '#9CA3AF', fontSize: 18 }}>{expandedRoom === room.id ? '▲' : '▼'}</span>
            </div>
          </div>

          {expandedRoom === room.id && (
            <div style={{ padding: '16px 20px' }}>
              {/* Items list */}
              {room.items.map(item => (
                <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>{item.item_name}</span>
                      <span style={{ background: CONDITION_BG[item.condition] ?? 'rgba(0,0,0,0.06)', color: CONDITION_COLOR[item.condition] ?? '#6B7280', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px' }}>
                        {item.condition}
                      </span>
                    </div>
                    {item.notes && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{item.notes}</div>}
                    <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                      by {item.profiles?.username} · {format(new Date(item.logged_at), 'MMM d, yyyy')}
                    </div>
                  </div>
                  {item.logged_by === user?.id && (
                    <button onClick={() => deleteItem(item.id)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.08)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11, flexShrink: 0 }}>✕</button>
                  )}
                </div>
              ))}

              {room.items.length === 0 && (
                <div style={{ color: '#9CA3AF', fontSize: 13, padding: '8px 0 12px' }}>No items logged for this room yet.</div>
              )}

              {/* Add item form */}
              {addingItemToRoom === room.id ? (
                <div style={{ marginTop: 12, padding: 16, background: 'rgba(37,99,235,0.04)', borderRadius: 12, border: '1px solid rgba(37,99,235,0.1)' }}>
                  <input className="glass-input" placeholder="Item (e.g. Wall paint, Carpet, Window, Door handle)" value={itemName} onChange={e => setItemName(e.target.value)} style={{ marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {CONDITIONS.map(c => (
                      <button key={c} onClick={() => setItemCondition(c)} style={{ padding: '5px 12px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: itemCondition === c ? (CONDITION_BG[c] ?? 'rgba(0,0,0,0.06)') : 'rgba(0,0,0,0.05)', color: itemCondition === c ? (CONDITION_COLOR[c] ?? '#374151') : '#6B7280', outline: itemCondition === c ? `1.5px solid ${CONDITION_COLOR[c]}` : 'none' }}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <input className="glass-input" placeholder="Notes (optional — e.g. small scuff on bottom-left)" value={itemNotes} onChange={e => setItemNotes(e.target.value)} style={{ marginBottom: 10 }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => addItem(room.id)} style={{ flex: 2, padding: '10px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Log Item</button>
                    <button onClick={() => setAddingItemToRoom(null)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={() => setAddingItemToRoom(room.id)} style={{ flex: 1, padding: '10px', borderRadius: 12, border: '1.5px dashed rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.04)', color: '#2563EB', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    + Log Item
                  </button>
                  <button onClick={() => deleteRoom(room.id)} style={{ padding: '10px 14px', borderRadius: 12, border: 'none', background: 'rgba(244,63,94,0.08)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    Delete Room
                  </button>
                </div>
              )}
            </div>
          )}
        </GlassPanel>
      ))}

      {rooms.length > 0 && (
        <GlassPanel style={{ padding: 16, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>💡 Tip</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Document any existing damage before you move in. This checklist is your evidence if the landlord disputes your deposit at move-out.</div>
        </GlassPanel>
      )}
    </div>
  )
}
