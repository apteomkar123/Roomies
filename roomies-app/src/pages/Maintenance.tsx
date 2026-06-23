import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { MaintenanceTicket, IncidentReport } from '../types'
import { format } from 'date-fns'

type Status = 'Open' | 'Vendor Dispatched' | 'Resolved'
type Tab = 'maintenance' | 'incidents'

const STATUS_STYLE: Record<Status, { bg: string; color: string }> = {
  'Open':              { bg: 'rgba(244,63,94,0.1)',   color: '#E11D48' },
  'Vendor Dispatched': { bg: 'rgba(245,158,11,0.1)',  color: '#D97706' },
  'Resolved':          { bg: 'rgba(16,185,129,0.1)',  color: '#059669' },
}

const SEVERITY_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'Low':       { bg: 'rgba(37,99,235,0.1)',   color: '#2563EB', icon: '🔵' },
  'Medium':    { bg: 'rgba(245,158,11,0.1)',  color: '#D97706', icon: '🟡' },
  'High':      { bg: 'rgba(244,63,94,0.1)',   color: '#E11D48', icon: '🔴' },
  'Emergency': { bg: 'rgba(139,92,246,0.15)', color: '#7C3AED', icon: '🚨' },
}

export default function Maintenance() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [tab, setTab] = useState<Tab>('maintenance')

  // Maintenance tickets
  const [tickets, setTickets] = useState<MaintenanceTicket[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [title, setTitle] = useState('')
  const [desc, setDesc] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Incident reports
  const [incidents, setIncidents] = useState<IncidentReport[]>([])
  const [showAddIncident, setShowAddIncident] = useState(false)
  const [incTitle, setIncTitle] = useState('')
  const [incDesc, setIncDesc] = useState('')
  const [incSeverity, setIncSeverity] = useState('Low')
  const [incImageFile, setIncImageFile] = useState<File | null>(null)
  const [incImagePreview, setIncImagePreview] = useState<string | null>(null)
  const incFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!household) return
    loadTickets()
    loadIncidents()
    const ch = supabase.channel(`maint:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tickets' }, loadTickets)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incident_reports', filter: `household_id=eq.${household.id}` }, loadIncidents)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadTickets() {
    if (!household) return
    const { data } = await supabase.from('maintenance_tickets').select('*, profiles(username)').eq('household_id', household.id).order('created_at', { ascending: false })
    setTickets((data ?? []) as MaintenanceTicket[])
  }

  async function loadIncidents() {
    if (!household) return
    const { data } = await supabase.from('incident_reports').select('*, profiles!reported_by(username)').eq('household_id', household.id).order('created_at', { ascending: false })
    setIncidents((data ?? []) as IncidentReport[])
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
    setTitle(''); setDesc(''); setImageFile(null); setImagePreview(null); setShowAdd(false); loadTickets()
  }

  async function updateStatus(id: string, status: Status) {
    await supabase.from('maintenance_tickets').update({ status }).eq('id', id)
    loadTickets()
  }

  async function deleteTicket(id: string) {
    await supabase.from('maintenance_tickets').delete().eq('id', id)
    loadTickets()
  }

  async function submitIncident() {
    if (!incTitle.trim() || !household) return
    setSaveError(null)
    let imageUrl: string | null = null
    if (incImageFile) {
      const path = `incidents/${Date.now()}_${incImageFile.name}`
      const { data: up } = await supabase.storage.from('homebase-property-vault').upload(path, incImageFile)
      if (up) {
        const { data: pub } = supabase.storage.from('homebase-property-vault').getPublicUrl(path)
        imageUrl = pub.publicUrl
      }
    }
    const { error } = await supabase.from('incident_reports').insert({
      household_id: household.id, reported_by: user!.id,
      title: incTitle.trim(), description: incDesc.trim(), severity: incSeverity, photo_url: imageUrl,
    })
    if (error) { setSaveError(error.message); return }
    setIncTitle(''); setIncDesc(''); setIncSeverity('Low'); setIncImageFile(null); setIncImagePreview(null); setShowAddIncident(false)
    loadIncidents()
  }

  async function resolveIncident(id: string) {
    await supabase.from('incident_reports').update({ resolved: true, resolved_at: new Date().toISOString() }).eq('id', id)
    loadIncidents()
  }

  async function deleteIncident(id: string) {
    await supabase.from('incident_reports').delete().eq('id', id)
    loadIncidents()
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setImageFile(f)
    setImagePreview(URL.createObjectURL(f))
  }

  function handleIncFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setIncImageFile(f)
    setIncImagePreview(URL.createObjectURL(f))
  }

  const openIncidents = incidents.filter(i => !i.resolved)
  const resolvedIncidents = incidents.filter(i => i.resolved)

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Maintenance</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Report &amp; track issues</div>
        </div>
        {tab === 'maintenance' && (
          <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Report</button>
        )}
        {tab === 'incidents' && (
          <button onClick={() => setShowAddIncident(!showAddIncident)} style={{ background: 'linear-gradient(135deg,#E11D48,#DC2626)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Log</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {([['maintenance', '🔧 Work Orders'], ['incidents', '🚨 Incidents']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: tab === t ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: tab === t ? 'white' : '#374151' }}>
            {label}
            {t === 'incidents' && openIncidents.length > 0 && (
              <span style={{ marginLeft: 6, background: '#E11D48', color: 'white', borderRadius: 999, fontSize: 10, fontWeight: 800, padding: '1px 6px' }}>{openIncidents.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── MAINTENANCE TAB ── */}
      {tab === 'maintenance' && (
        <>
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
                    {isReporter && <button onClick={() => deleteTicket(t.id)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>}
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
        </>
      )}

      {/* ── INCIDENTS TAB ── */}
      {tab === 'incidents' && (
        <>
          {showAddIncident && (
            <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
              {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
              <input className="glass-input" placeholder="Incident title (e.g. Broken window, Water leak)" value={incTitle} onChange={e => setIncTitle(e.target.value)} style={{ marginBottom: 12 }} />
              <textarea className="glass-input" placeholder="Describe what happened…" value={incDesc} onChange={e => setIncDesc(e.target.value)} rows={3} style={{ resize: 'vertical', marginBottom: 12 }} />
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>Severity</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {(['Low', 'Medium', 'High', 'Emergency'] as const).map(s => {
                    const sv = SEVERITY_STYLE[s]
                    return (
                      <button key={s} onClick={() => setIncSeverity(s)} style={{ padding: '6px 14px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: incSeverity === s ? sv.bg : 'rgba(0,0,0,0.05)', color: incSeverity === s ? sv.color : '#6B7280', outline: incSeverity === s ? `1.5px solid ${sv.color}` : 'none' }}>
                        {sv.icon} {s}
                      </button>
                    )
                  })}
                </div>
              </div>
              <div onClick={() => incFileRef.current?.click()} style={{ border: '2px dashed rgba(244,63,94,0.3)', borderRadius: 14, padding: '20px', textAlign: 'center', cursor: 'pointer', marginBottom: 14, background: 'rgba(244,63,94,0.03)' }}>
                {incImagePreview ? <img src={incImagePreview} style={{ maxHeight: 160, borderRadius: 10, objectFit: 'cover' }} alt="preview" /> : <div style={{ color: '#9CA3AF', fontWeight: 600 }}>📷 Attach photo (optional)</div>}
              </div>
              <input ref={incFileRef} type="file" accept="image/*" onChange={handleIncFile} style={{ display: 'none' }} />
              <button onClick={submitIncident} style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#E11D48,#DC2626)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>Log Incident</button>
            </GlassPanel>
          )}

          <GlassPanel style={{ padding: 16, marginBottom: 16, background: 'rgba(244,63,94,0.04)', border: '1px solid rgba(244,63,94,0.15)' }}>
            <div style={{ fontSize: 12, color: '#E11D48', fontWeight: 700, marginBottom: 4 }}>⚠️ About Incident Reports</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Formal log for safety or property incidents — broken windows, water leaks, security issues. Timestamped and documented for your records.</div>
          </GlassPanel>

          {openIncidents.length === 0 && resolvedIncidents.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9CA3AF' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>No incidents logged</div>
              <div style={{ fontSize: 14, marginTop: 4 }}>Tap "Log" to document a safety or property incident</div>
            </div>
          )}

          {openIncidents.map(inc => {
            const sv = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE['Low']
            const isReporter = inc.reported_by === user?.id
            return (
              <GlassPanel key={inc.id} style={{ padding: 20, marginBottom: 16, border: `1.5px solid ${inc.severity === 'Emergency' ? 'rgba(139,92,246,0.4)' : inc.severity === 'High' ? 'rgba(244,63,94,0.3)' : 'transparent'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ background: sv.bg, color: sv.color, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 10px' }}>{sv.icon} {inc.severity}</span>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: 16 }}>{inc.title}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>by {inc.profiles?.username} · {format(new Date(inc.created_at), 'MMM d, yyyy HH:mm')}</div>
                  </div>
                  {isReporter && <button onClick={() => deleteIncident(inc.id)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>}
                </div>
                {inc.description && <div style={{ fontSize: 14, color: '#374151', marginBottom: 12, lineHeight: 1.6 }}>{inc.description}</div>}
                {inc.photo_url && <img src={inc.photo_url} alt="incident" style={{ width: '100%', borderRadius: 12, maxHeight: 200, objectFit: 'cover', marginBottom: 12 }} />}
                <button onClick={() => resolveIncident(inc.id)} style={{ padding: '8px 16px', borderRadius: 10, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>✓ Mark Resolved</button>
              </GlassPanel>
            )
          })}

          {resolvedIncidents.length > 0 && (
            <GlassPanel style={{ padding: 20, opacity: 0.7 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Resolved Incidents</div>
              {resolvedIncidents.slice(0, 5).map(inc => {
                const sv = SEVERITY_STYLE[inc.severity] ?? SEVERITY_STYLE['Low']
                return (
                  <div key={inc.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)', alignItems: 'center' }}>
                    <div>
                      <span style={{ background: sv.bg, color: sv.color, fontSize: 10, fontWeight: 700, borderRadius: 999, padding: '1px 7px', marginRight: 6 }}>{sv.icon} {inc.severity}</span>
                      <span style={{ fontWeight: 600, fontSize: 14, color: '#6B7280' }}>{inc.title}</span>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{format(new Date(inc.created_at), 'MMM d, yyyy')}</div>
                    </div>
                    <button onClick={() => deleteIncident(inc.id)} style={{ padding: '4px 8px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.06)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 11 }}>✕</button>
                  </div>
                )
              })}
            </GlassPanel>
          )}
        </>
      )}
    </div>
  )
}
