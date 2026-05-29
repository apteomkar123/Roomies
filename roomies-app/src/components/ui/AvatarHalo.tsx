import type { PresenceStatus } from '../../types'

interface Props {
  avatarUrl: string | null
  status: PresenceStatus
  size?: number
  username?: string
}

const STATUS_STYLES: Record<PresenceStatus, { border: string; shadow: string; pulse?: boolean }> = {
  'Available':              { border: '#10B981', shadow: '0 0 0 3px rgba(16,185,129,0.3), 0 0 16px rgba(16,185,129,0.4)' },
  'Sleeping':               { border: '#8B5CF6', shadow: '0 0 0 3px rgba(139,92,246,0.3), 0 0 16px rgba(139,92,246,0.4)' },
  'Quiet Hours / Studying': { border: '#F59E0B', shadow: '0 0 0 3px rgba(245,158,11,0.3), 0 0 16px rgba(245,158,11,0.4)' },
  'Work From Home':         { border: '#2563EB', shadow: '0 0 0 3px rgba(37,99,235,0.3), 0 0 16px rgba(37,99,235,0.4)' },
  'Away':                   { border: '#F43F5E', shadow: '0 0 0 3px rgba(244,63,94,0.3), 0 0 16px rgba(244,63,94,0.4)', pulse: true },
}

export default function AvatarHalo({ avatarUrl, status, size = 48, username }: Props) {
  const st = STATUS_STYLES[status] ?? STATUS_STYLES['Available']
  const initials = username ? username.slice(0, 2).toUpperCase() : '?'

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {/* Outer glow ring */}
      <div
        style={{
          width: size + 8,
          height: size + 8,
          borderRadius: '50%',
          border: `2.5px solid ${st.border}`,
          boxShadow: st.shadow,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          animation: st.pulse ? 'pulseGlow 2s ease-in-out infinite' : undefined,
          background: 'rgba(255,255,255,0.15)',
          backdropFilter: 'blur(4px)',
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={username}
            style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: size, height: size, borderRadius: '50%',
              background: 'linear-gradient(135deg, #2563EB, #8B5CF6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 800, fontSize: size * 0.36,
            }}
          >
            {initials}
          </div>
        )}
      </div>
      {/* Status dot */}
      <span
        style={{
          position: 'absolute', bottom: 2, right: 2,
          width: 11, height: 11, borderRadius: '50%',
          background: st.border, border: '2px solid white',
        }}
      />
    </div>
  )
}
