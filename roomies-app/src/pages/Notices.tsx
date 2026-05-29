import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'
import type { Notice } from '../types'
import { format } from 'date-fns'

type NoticeType = 'Instant Buzz Notification' | 'Permanent Memo' | 'Formal Landlord Notice'

const TYPE_STYLE: Record<NoticeType, { bg: string; color: string; label: string }> = {
  'Instant Buzz Notification': { bg: 'rgba(245,158,11,0.12)', color: '#D97706', label: '⚡ Buzz' },
  'Permanent Memo':            { bg: 'rgba(37,99,235,0.08)',  color: '#1D4ED8', label: '📌 Memo' },
  'Formal Landlord Notice':    { bg: 'rgba(244,63,94,0.08)',  color: '#BE123C', label: '📋 Landlord' },
}

export default function Notices() {
  const { user } = useAuth()
  const { household } = useHousehold()
  const [notices, setNotices] = useState<Notice[]>([])
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [showAdd, setShowAdd] = useState(false)
  const [body, setBody] = useState('')
  const [title, setTitle] = useState('')
  const [type, setType] = useState<NoticeType>('Permanent Memo')

  useEffect(() => {
    if (!household) return
    loadNotices()
    const ch = supabase.channel(`notices:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, loadNotices)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household])

  async function loadNotices() {
    if (!household) return
    const { data } = await supabase.from('notices').select('*, profiles(username), read_acks(user_id)').eq('household_id', household.id).order('created_at', { ascending: false })
    setNotices((data ?? []) as Notice[])
    const myReads = new Set<string>()
    for (const n of (data ?? [])) {
      if ((n as any).read_acks?.some((r: any) => r.user_id === user?.id)) myReads.add(n.id)
    }
    setReadIds(myReads)
  }

  async function acknowledge(noticeId: string) {
    await supabase.from('read_acks').upsert({ notice_id: noticeId, user_id: user!.id })
    setReadIds(prev => new Set(prev).add(noticeId))
  }

  async function post() {
    if (!body.trim() || !household) return
    await supabase.from('notices').insert({ household_id: household.id, author_id: user!.id, title: title || null, body, type })
    setBody(''); setTitle(''); setShowAdd(false); loadNotices()
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Notices</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>House broadcasts &amp; memos</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Post
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <input className="glass-input" placeholder="Title (optional)" value={title} onChange={e => setTitle(e.target.value)} style={{ marginBottom: 12 }} />
          <textarea className="glass-input" placeholder="Notice body…" value={body} onChange={e => setBody(e.target.value)} rows={3} style={{ resize: 'vertical', marginBottom: 12 }} />
          <select value={type} onChange={e => setType(e.target.value as NoticeType)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 14, fontFamily: 'inherit' }}>
            <option>Permanent Memo</option>
            <option>Instant Buzz Notification</option>
            <option>Formal Landlord Notice</option>
          </select>
          <button className="btn-blue" onClick={post}>Post Notice</button>
        </GlassPanel>
      )}

      {notices.map(n => {
        const st = TYPE_STYLE[n.type as NoticeType] ?? TYPE_STYLE['Permanent Memo']
        const read = readIds.has(n.id)
        return (
          <GlassPanel key={n.id} style={{ padding: 20, marginBottom: 16, border: `1.5px solid ${read ? 'transparent' : 'rgba(37,99,235,0.2)'}`, opacity: read ? 0.8 : 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ background: st.bg, color: st.color, padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>{st.label}</span>
                {!read && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', display: 'inline-block' }} />}
              </div>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>{format(new Date(n.created_at), 'MMM d, HH:mm')}</span>
            </div>
            {n.title && <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>{n.title}</div>}
            <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.6 }}>{n.body}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
              <span style={{ fontSize: 12, color: '#9CA3AF' }}>by {(n as any).profiles?.username}</span>
              {!read && (
                <button onClick={() => acknowledge(n.id)} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(16,185,129,0.1)', color: '#059669', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>✓ Acknowledge</button>
              )}
            </div>
          </GlassPanel>
        )
      })}

      {notices.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📢</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No notices yet</div>
        </div>
      )}
    </div>
  )
}
