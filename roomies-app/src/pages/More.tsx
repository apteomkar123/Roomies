import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { supabase } from '../lib/supabase'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'

export default function More() {
  const { profile, user, signOut, refreshProfile } = useAuth()
  const { household } = useHousehold()
  const navigate = useNavigate()

  async function rerunTutorial() {
    if (!user) return
    await supabase.from('profiles').update({ has_completed_roomies_tutorial: false }).eq('id', user.id)
    await refreshProfile()
    // TutorialContext watches profile and resets step automatically
  }

  const PAGES = [
    { icon: '🛒', label: 'Shopping List',   path: '/shopping' },
    { icon: '🐾', label: 'Pet Care',         path: '/pets'     },
    { icon: '👥', label: 'Guest Log',        path: '/guests'   },
    { icon: '🔒', label: 'Lockbox',          path: '/lockbox'  },
    { icon: '📊', label: 'Karma Leaderboard', path: '/karma'   },
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

      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>@{profile?.username}</div>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>⭐ {profile?.karma} karma</div>
          </div>
          <button onClick={signOut} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Sign Out</button>
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
