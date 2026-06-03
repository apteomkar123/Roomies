import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { MaintenanceTicket } from '../types'
import { format } from 'date-fns'

type Status = 'Open' | 'Vendor Dispatched' | 'Resolved'

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  'Open':              { bg: 'rgba(244,63,94,0.1)',   color: '#E11D48' },
  'Vendor Dispatched': { bg: 'rgba(245,158,11,0.1)',  color: '#D97706' },
  'Resolved':          { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
}

export default function Maintenance() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`maint:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tickets' }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const { data } = await supabase.from('maintenance_tickets').select('*, profiles(username)').eq('household_id', household.id).order('created_at', { ascending: false })
    setTickets((data ?? []) as MaintenanceTicket[])
  }

  async function submit() {
    if (!title.trim() || !household) return
    setSaveError(null)
    let imageUrl: string | null = null
    if (imageFile) {
      const path = `maintenance/${Date.now()}_${imageFile.name}`
      const { data: up } = await supabase.storage.from('homebase-property-vault').upload(path, imageFile)
      if (up) {
        const { data: pub } = supabase.storage.from('homebase-property-vault').getPublicUrl(path)
        imageUrl = pub.publicUrl
      }
    }
    const { error } = await supabase.from('maintenance_tickets').insert({ household_id: household.id, reported_by: user!.id, title, description: desc, image_url: imageUrl })
    if (error) { setSaveError(error.message); return }
    setTitle(''); setDesc(''); setImageFile(null); setImagePreview(null); setShowAdd(false); load()
  }

  async function updateStatus(id: string, status: Status) {
    await supabase.from('maintenance_tickets').update({ status }).eq('id', id)
    load()
  }

  async function deleteTicket(id: string) {
    await supabase.from('maintenance_tickets').delete().eq('id', id)
    load()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Maintenance</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Report &amp; track property issues</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Report
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
          <input className="glass-input" placeholder="Issue title" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
          <textarea className="glass-input" placeholder="Describe the issue…" value={desc} onChange={e => setDesc(e.target.value)} rows={3} style={{ resize: 'vertical', marginBottom: 12 }} />
          <div onClick={() => fileRef.current?.click()} style={{ border: '2px dashed rgba(37,99,235,0.3)', borderRadius: 14, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: 'rgba(37,99,235,0.04)' }}>
            {imagePreview ? <img src={imagePreview} style={{ maxHeight: 160, borderRadius: 10, objectFit: 'cover' }} alt="preview" /> : <div style={{ color: '#9CA3AF', fontWeight: 600 }}>📷 Attach photo</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
          <button className="btn-blue" onClick={submit}>Submit Ticket</button>
        </GlassPanel>
      )}

      {tickets.map(t => {
        const st = STATUS_STYLE[t.status as Status] ?? STATUS_STYLE['Open']
        const isReporter = t.reported_by === user?.id
        return (
          <GlassPanel key={t.id} style={{ padding: 20, marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>{t.title}</div>
                <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>by {t.profiles?.username} · {format(new Date(t.created_at), 'MMM d')}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: st.bg, color: st.color, padding: '4px 12px', borderRadius: 999, fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{t.status}</span>
                {isReporter && (
                  <button onClick={() => deleteTicket(t.id)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
                )}
              </div>
            </div>
            {t.description && <div style={{ fontSize: 14, color: '#374151', marginBottom: 12, lineHeight: 1.6 }}>{t.description}</div>}
            {t.image_url && <img src={t.image_url} alt="issue" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', marginBottom: 12 }} />}
            {t.status !== 'Resolved' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {t.status === 'Open' && <button onClick={() => updateStatus(t.id, 'Vendor Dispatched')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(245,158,11,0.1)', color: '#D97706', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Dispatch Vendor</button>}
                <button onClick={() => updateStatus(t.id, 'Resolved')} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>Mark Resolved</button>
              </div>
            )}
          </GlassPanel>
        )
      })}

      {tickets.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔧</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No tickets yet</div>
        </div>
      )}
    </div>
  )
}
