import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { supabase } from '../lib/supabase'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'

export default function More() {
  const { profile, user, signOut, refreshProfile, updateAvatar } = useAuth()
  const { household } = useHousehold()
  const navigate = useNavigate()

  const [uploading, setUploading] = useState<{ global: boolean; roomies: boolean }>({ global: false, roomies: false })
  const globalRef = useRef<HTMLInputElement>(null)
  const roomiesRef = useRef<HTMLInputElement>(null)

  async function rerunTutorial() {
    if (!user) return
    await supabase.from('profiles').update({ has_completed_roomies_tutorial: false }).eq('id', user.id)
    await refreshProfile()
  }

  async function handleAvatarUpload(file: File, type: 'global' | 'roomies') {
    setUploading(prev => ({ ...prev, [type]: true }))
    await updateAvatar(file, type)
    setUploading(prev => ({ ...prev, [type]: false }))
  }

  const photo = profile?.roomies_avatar_url || profile?.avatar_url

  const PAGES = [
    { icon: '🛒', label: 'Shopping List',    path: '/shopping' },
    { icon: '🐾', label: 'Pet Care',          path: '/pets'     },
    { icon: '👥', label: 'Guest Log',         path: '/guests'   },
    { icon: '🔒', label: 'Lockbox',           path: '/lockbox'  },
    { icon: '📊', label: 'Karma Leaderboard', path: '/karma'    },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>More</h1>

      {household && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Invite Code</div>
          <div style={{ fontWeight: 900, fontSize: 32, letterSpacing: '0.2em', color: '#2563EB', fontFamily: 'monospace' }}>{household.invite_code}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Share with roommates to join {household.name}</div>
        </GlassPanel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {PAGES.map(p => (
          <GlassPanel key={p.path} onClick={() => navigate(p.path)} style={{ padding: 20, cursor: 'pointer', transition: 'transform 0.15s' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{p.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</div>
          </GlassPanel>
        ))}
      </div>

      {/* Profile card with avatar */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
                : <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#6366f1' }}>
                    {profile?.username?.slice(0,1).toUpperCase() ?? '?'}
                  </div>
              }
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>@{profile?.username}</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>⭐ {profile?.karma} karma</div>
            </div>
          </div>
          <button onClick={signOut} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Sign Out</button>
        </div>

        {/* Avatar upload controls */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <button
              onClick={() => globalRef.current?.click()}
              disabled={uploading.global}
              style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(99,102,241,0.08)', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {uploading.global ? '⏳ Uploading…' : '🌐 AppWare Photo'}
            </button>
            <input ref={globalRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0], 'global'); e.currentTarget.value = '' }} />
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Syncs across all apps</div>
          </div>
          <div style={{ flex: 1 }}>
            <button
              onClick={() => roomiesRef.current?.click()}
              disabled={uploading.roomies}
              style={{ width: '100%', padding: '10px 0', borderRadius: 12, border: '1px solid rgba(37,99,235,0.3)', background: 'rgba(37,99,235,0.08)', color: '#2563EB', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {uploading.roomies ? '⏳ Uploading…' : '🏠 Roomies Photo'}
            </button>
            <input ref={roomiesRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { if (e.target.files?.[0]) handleAvatarUpload(e.target.files[0], 'roomies'); e.currentTarget.value = '' }} />
            <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 4, textAlign: 'center' }}>Overrides in Roomies only</div>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>App Tutorial</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>Rewatch the feature walkthrough from the beginning.</div>
        <button onClick={rerunTutorial} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
          Rerun Tutorial
        </button>
      </GlassPanel>
    </div>
  )
}
