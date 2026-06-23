import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import { useAuth } from '../context/AuthContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import AvatarHalo from '../components/ui/AvatarHalo'
import { startOfWeek, subWeeks, endOfWeek } from 'date-fns'

const MEDALS = ['🥇', '🥈', '🥉']

function StreakBadge({ streak }: { streak: number }) {
  if (streak === 0) return null
  const color = streak >= 4 ? '#F59E0B' : streak >= 2 ? '#8B5CF6' : '#10B981'
  const bg = streak >= 4 ? 'rgba(245,158,11,0.12)' : streak >= 2 ? 'rgba(139,92,246,0.1)' : 'rgba(16,185,129,0.1)'
  const icon = streak >= 4 ? '🔥' : streak >= 2 ? '⚡' : '✓'
  return (
    <span style={{ background: bg, color, fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {icon} {streak}w streak
    </span>
  )
}

export default function Karma() {
  const { profile } = useAuth()
  const { household, memberProfiles } = useHousehold()
  const [streaks, setStreaks] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!household || memberProfiles.length === 0) return
    computeStreaks()
  }, [household, memberProfiles]) // eslint-disable-line react-hooks/exhaustive-deps

  async function computeStreaks() {
    if (!household) return
    // Look back 8 weeks to find consecutive completion weeks per member
    const weeksToCheck = 8
    const weeklyCompletion: Record<string, boolean[]> = {}
    for (const p of memberProfiles) weeklyCompletion[p.id] = []

    for (let w = 0; w < weeksToCheck; w++) {
      const weekStart = startOfWeek(subWeeks(new Date(), w), { weekStartsOn: 1 }).toISOString()
      const weekEnd = endOfWeek(subWeeks(new Date(), w), { weekStartsOn: 1 }).toISOString()

      const { data } = await supabase
        .from('chore_assignments')
        .select('assigned_to, status')
        .eq('status', 'Completed')
        .gte('completed_at', weekStart)
        .lte('completed_at', weekEnd)

      for (const p of memberProfiles) {
        const completed = (data ?? []).some(a => a.assigned_to === p.id)
        weeklyCompletion[p.id].push(completed)
      }
    }

    const result: Record<string, number> = {}
    for (const p of memberProfiles) {
      let streak = 0
      for (const completed of weeklyCompletion[p.id]) {
        if (completed) streak++
        else break
      }
      result[p.id] = streak
    }
    setStreaks(result)
  }

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
        const streak = streaks[p.id] ?? 0
        return (
          <GlassPanel key={p.id} style={{ padding: '16px 20px', marginBottom: 12, border: isMe ? '1.5px solid rgba(37,99,235,0.3)' : undefined, background: isMe ? 'rgba(37,99,235,0.03)' : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 28, width: 36, textAlign: 'center', flexShrink: 0 }}>
                {i < 3 ? MEDALS[i] : <span style={{ fontWeight: 800, color: '#9CA3AF', fontSize: 16 }}>#{i + 1}</span>}
              </div>
              <AvatarHalo avatarUrl={p.homebase_avatar_url ?? p.avatar_url} status="Available" size={40} username={p.username} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {p.username}{isMe && <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 700 }}>You</span>}
                  <StreakBadge streak={streak} />
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
          { icon: '🍂', text: 'Complete a seasonal task', points: '+reward' },
        ].map(r => (
          <div key={r.text} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>{r.icon}</span>
              <span style={{ fontSize: 14, color: '#374151' }}>{r.text}</span>
            </div>
            <span style={{ fontWeight: 800, color: '#10B981', fontSize: 14 }}>{r.points}</span>
          </div>
        ))}
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(245,158,11,0.07)', borderRadius: 10, border: '1px solid rgba(245,158,11,0.2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#D97706', marginBottom: 4 }}>Streak Badges</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>✓ 1w streak</span>
            <span style={{ background: 'rgba(139,92,246,0.1)', color: '#8B5CF6', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>⚡ 2w streak</span>
            <span style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 8px' }}>🔥 4w streak</span>
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>Complete at least one chore every week to keep your streak going</div>
        </div>
      </GlassPanel>
    </div>
  )
}
