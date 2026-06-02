import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useHousehold } from '../../context/HouseholdContext'
import { supabase } from '../../lib/supabase'

const NAV = [
  { path: '/',            icon: '⌂',  label: 'Home'     },
  { path: '/chores',      icon: '✓',  label: 'Chores'   },
  { path: '/finance',     icon: '$',  label: 'Bills'    },
  { path: '/notices',     icon: '📢', label: 'Notices'  },
  { path: '/bookings',    icon: '📅', label: 'Book'     },
  { path: '/maintenance', icon: '🔧', label: 'Fix'      },
  { path: '/shopping',    icon: '🛒', label: 'Shopping' },
  { path: '/pets',        icon: '🐾', label: 'Pets'     },
  { path: '/guests',      icon: '👥', label: 'Guests'   },
  { path: '/lockbox',     icon: '🔒', label: 'Lockbox'  },
  { path: '/karma',       icon: '⭐', label: 'Karma'    },
  { path: '/more',        icon: '⚙️', label: 'Settings' },
]

const BADGE_PAGES = ['/notices', '/maintenance']

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { user } = useAuth()
  const { household } = useHousehold()
  const [badges, setBadges] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!household || !user) return
    fetchBadges()
    const ch = supabase.channel(`nav-badges:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notices' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'read_acks' }, fetchBadges)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_tickets' }, fetchBadges)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household?.id, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchBadges() {
    if (!household || !user) return
    const [{ data: notices }, { data: tickets }] = await Promise.all([
      supabase.from('notices').select('id, read_acks(user_id)').eq('household_id', household.id),
      supabase.from('maintenance_tickets').select('id').eq('household_id', household.id).eq('status', 'Open'),
    ])
    const unreadNotices = (notices ?? []).filter(n => !n.read_acks?.some((r: { user_id: string }) => r.user_id === user.id)).length
    setBadges({
      '/notices': unreadNotices,
      '/maintenance': (tickets ?? []).length,
    })
  }

  return (
    <nav id="tut-navbar" className="nav-sidebar">
      <div className="nav-logo">Roomies</div>
      {NAV.map(item => {
        const active = path === item.path
        const count = BADGE_PAGES.includes(item.path) ? (badges[item.path] ?? 0) : 0
        return (
          <button
            key={item.path}
            className={`nav-item${active ? ' active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
            {count > 0 && (
              <span className="nav-badge">{count > 9 ? '9+' : count}</span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
