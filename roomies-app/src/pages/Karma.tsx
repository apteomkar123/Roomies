import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import AvatarHalo from '../components/ui/AvatarHalo'

const MEDALS = ['🥇', '🥈', '🥉']

export default function Karma() {
  const { profile } = useAuth()
  const { memberProfiles } = useHousehold()

  const ranked = [...memberProfiles].sort((a, b) => (b.karma ?? 0) - (a.karma ?? 0))

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />


      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Karma</h1>
      <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Household leaderboard</div>

      {ranked.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⭐</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>No members yet</div>
        </div>
      )}

      {ranked.map((p, i) => {
        const isMe = p.id === profile?.id
        return (
          <GlassPanel key={p.id} style={{ padding: '16px 20px', marginBottom: 12, border: isMe ? '1.5px solid rgba(37,99,235,0.3)' : undefined, background: isMe ? 'rgba(37,99,235,0.03)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 28, width: 36, textAlign: 'center', flexShrink: 0 }}>
                {i < 3 ? MEDALS[i] : <span style={{ fontWeight: 800, color: '#9CA3AF', fontSize: 16 }}>#{i + 1}</span>}
              </div>
              <AvatarHalo avatarUrl={p.homebase_avatar_url ?? p.avatar_url} status="Available" size={40} username={p.username} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>
                  {p.username}{isMe && <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 700, marginLeft: 6 }}>You</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 900, fontSize: 22, color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#B45309' : '#374151' }}>
                  {p.karma ?? 0}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>karma</div>
              </div>
            </div>
          </GlassPanel>
        )
      })}

      <GlassPanel style={{ padding: 20, marginTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>How to earn karma</div>
        {[
          { icon: '✓', text: 'Complete a chore', points: '+10' },
          { icon: '🏆', text: 'Claim an auctioned chore', points: '+bounty' },
        ].map(r => (
          <div key={r.text} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <span style={{ fontSize: 14, color: '#374151' }}>{r.text}</span>
            </div>
            <span style={{ fontWeight: 800, color: '#10B981', fontSize: 14 }}>{r.points}</span>
          </div>
        ))}
      </GlassPanel>
    </div>
  )
}
