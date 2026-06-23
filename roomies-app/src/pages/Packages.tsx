import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { Package } from '../types'
import { format } from 'date-fns'

const CARRIERS = ['Amazon', 'UPS', 'FedEx', 'USPS', 'DHL', 'Other']
const STATUS_STYLE: Record<string, { bg: string; color: string; icon: string }> = {
  'Expected':  { bg: 'rgba(245,158,11,0.1)',   color: '#D97706', icon: '📦' },
  'Arrived':   { bg: 'rgba(37,99,235,0.1)',    color: '#2563EB', icon: '📬' },
  'Picked Up': { bg: 'rgba(16,185,129,0.1)',   color: '#059669', icon: '✅' },
}

export default function Packages() {
  const { user } = useAuth()
  const { household, memberProfiles } = useHousehold()
  const [packages, setPackages] = useState<Package[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [description, setDescription] = useState('')
  const [carrier, setCarrier] = useState('')
  const [tracking, setTracking] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [filter, setFilter] = useState<'all' | 'Expected' | 'Arrived' | 'Picked Up'>('all')
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`packages:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'packages', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const { data } = await supabase
      .from('packages')
      .select('*, profiles!logged_by(username, avatar_url)')
      .eq('household_id', household.id)
      .order('created_at', { ascending: false })
    setPackages((data ?? []) as Package[])
  }

  async function addPackage() {
    if (!description.trim() || !household) return
    setSaveError(null)
    const { error } = await supabase.from('packages').insert({
      household_id: household.id,
      logged_by: user!.id,
      description: description.trim(),
      carrier: carrier || null,
      tracking_number: tracking.trim() || null,
      expected_date: expectedDate || null,
    })
    if (error) { setSaveError(error.message); return }
    setDescription(''); setCarrier(''); setTracking(''); setExpectedDate(''); setShowAdd(false)
    load()
  }

  async function markArrived(id: string) {
    await supabase.from('packages').update({ status: 'Arrived', arrived_at: new Date().toISOString() }).eq('id', id)
    load()
  }

  async function markPickedUp(id: string) {
    await supabase.from('packages').update({ status: 'Picked Up', picked_up_by: user!.id }).eq('id', id)
    load()
  }

  async function deletePackage(id: string) {
    await supabase.from('packages').delete().eq('id', id)
    load()
  }

  const profileMap = Object.fromEntries(memberProfiles.map(p => [p.id, p.username]))
  const filtered = filter === 'all' ? packages : packages.filter(p => p.status === filter)
  const arrived = packages.filter(p => p.status === 'Arrived')

  return (
    <div id="tut-packages" style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Packages</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Track deliveries</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Log Package
        </button>
      </div>

      {/* Arrived alert */}
      {arrived.length > 0 && (
        <GlassPanel style={{ padding: '14px 16px', marginBottom: 16, background: 'rgba(37,99,235,0.08)', border: '1.5px solid rgba(37,99,235,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>📬</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#2563EB' }}>{arrived.length} package{arrived.length > 1 ? 's' : ''} waiting to be picked up!</div>
              <div style={{ fontSize: 12, color: '#6B7280' }}>Check the lobby / mailroom</div>
            </div>
          </div>
        </GlassPanel>
      )}

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Log Expected Package</div>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
          <input className="glass-input" placeholder="What is it? (e.g. Amazon order — headphones)" value={description} onChange={e => setDescription(e.target.value)} style={{ marginBottom: 12 }} />
          <select value={carrier} onChange={e => setCarrier(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}>
            <option value="">Carrier (optional)</option>
            {CARRIERS.map(c => <option key={c}>{c}</option>)}
          </select>
          <input className="glass-input" placeholder="Tracking number (optional)" value={tracking} onChange={e => setTracking(e.target.value)} style={{ marginBottom: 12 }} />
          <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>Expected date (optional)</label>
          <input type="date" className="glass-input" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} style={{ marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-blue" onClick={addPackage}>Log Package</button>
            <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
          </div>
        </GlassPanel>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {(['all', 'Expected', 'Arrived', 'Picked Up'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding: '6px 16px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', background: filter === f ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: filter === f ? 'white' : '#374151' }}>
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <GlassPanel style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No packages{filter !== 'all' ? ` (${filter})` : ''}</div>
          <div style={{ color: '#9CA3AF', fontSize: 14 }}>Log an expected delivery to track it here</div>
        </GlassPanel>
      )}

      {filtered.map(pkg => {
        const st = STATUS_STYLE[pkg.status] ?? STATUS_STYLE['Expected']
        const isOwn = pkg.logged_by === user?.id
        return (
          <GlassPanel key={pkg.id} style={{ padding: 16, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 18 }}>{st.icon}</span>
                  <span style={{ fontWeight: 700, fontSize: 15 }}>{pkg.description}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ background: st.bg, color: st.color, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 10px' }}>{pkg.status}</span>
                  {pkg.carrier && <span style={{ background: 'rgba(0,0,0,0.06)', fontSize: 11, fontWeight: 600, borderRadius: 999, padding: '2px 10px', color: '#6B7280' }}>{pkg.carrier}</span>}
                </div>
                <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                  Logged by {pkg.profiles?.username ?? 'someone'} · {format(new Date(pkg.created_at), 'MMM d')}
                  {pkg.expected_date && ` · Expected ${format(new Date(pkg.expected_date), 'MMM d')}`}
                </div>
                {pkg.tracking_number && (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, fontFamily: 'monospace' }}>
                    #{pkg.tracking_number}
                  </div>
                )}
                {pkg.status === 'Picked Up' && pkg.picked_up_by && (
                  <div style={{ fontSize: 12, color: '#059669', fontWeight: 600, marginTop: 4 }}>
                    ✓ Picked up by {profileMap[pkg.picked_up_by] ?? 'someone'} · {pkg.arrived_at ? format(new Date(pkg.arrived_at), 'MMM d') : ''}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                {pkg.status === 'Expected' && (
                  <button onClick={() => markArrived(pkg.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(37,99,235,0.12)', color: '#2563EB', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, whiteSpace: 'nowrap' }}>
                    Mark Arrived
                  </button>
                )}
                {pkg.status === 'Arrived' && (
                  <button onClick={() => markPickedUp(pkg.id)} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(16,185,129,0.12)', color: '#059669', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, whiteSpace: 'nowrap' }}>
                    Picked Up
                  </button>
                )}
                {isOwn && (
                  <button onClick={() => deletePackage(pkg.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
                )}
              </div>
            </div>
          </GlassPanel>
        )
      })}
    </div>
  )
}
