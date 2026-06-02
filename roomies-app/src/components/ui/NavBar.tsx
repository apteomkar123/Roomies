import { useEffect, useRef, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { useHousehold } from '../../context/HouseholdContext'
import { supabase } from '../../lib/supabase'
import {
  Home, CheckSquare, DollarSign, Bell, Calendar, Wrench,
  ShoppingCart, PawPrint, Users, Lock, Star, Settings, Menu, X
} from 'lucide-react'

const NAV = [
  { path: '/',            icon: <Home size={22} />,        label: 'Home'     },
  { path: '/chores',      icon: <CheckSquare size={22} />, label: 'Chores'   },
  { path: '/finance',     icon: <DollarSign size={22} />,  label: 'Bills'    },
  { path: '/notices',     icon: <Bell size={22} />,        label: 'Notices'  },
  { path: '/bookings',    icon: <Calendar size={22} />,    label: 'Book'     },
  { path: '/maintenance', icon: <Wrench size={22} />,      label: 'Fix'      },
  { path: '/shopping',    icon: <ShoppingCart size={22} />,label: 'Shopping' },
  { path: '/pets',        icon: <PawPrint size={22} />,    label: 'Pets'     },
  { path: '/guests',      icon: <Users size={22} />,       label: 'Guests'   },
  { path: '/lockbox',     icon: <Lock size={22} />,        label: 'Lockbox'  },
  { path: '/karma',       icon: <Star size={22} />,        label: 'Karma'    },
  { path: '/more',        icon: <Settings size={22} />,    label: 'Settings' },
]

const BADGE_PAGES = ['/notices', '/maintenance']

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname
  const { user } = useAuth()
  const { household } = useHousehold()
  const [badges, setBadges] = useState<Record<string, number>>({})
  const [navOpen, setNavOpen] = useState(false)
  const touchStartX = useRef<number | null>(null)

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

  // Swipe right from left edge to open; swipe left to close
  const handleTouchStart = useCallback((e: TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
  }, [])

  const handleTouchEnd = useCallback((e: TouchEvent) => {
    if (touchStartX.current === null) return
    const startX = touchStartX.current
    const deltaX = e.changedTouches[0].clientX - startX
    if (deltaX > 60 && !navOpen && startX < 30) setNavOpen(true)
    else if (deltaX < -60 && navOpen) setNavOpen(false)
    touchStartX.current = null
  }, [navOpen])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchend', handleTouchEnd, { passive: true })
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchEnd])

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

  const go = (p: string) => { navigate(p); setNavOpen(false) }

  return (
    <>
      {/* Hamburger button — always visible, fixed top-left */}
      <button
        id="tut-nav-open"
        onClick={() => setNavOpen(v => !v)}
        style={{
          position: 'fixed', top: 16, left: 16, zIndex: 60,
          width: 44, height: 44, borderRadius: 14,
          background: 'rgba(255,255,255,0.72)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.5)',
          boxShadow: '0 4px 16px rgba(37,99,235,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: '#2563EB',
        }}
      >
        {navOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop */}
      {navOpen && (
        <div
          onClick={() => setNavOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.15)' }}
        />
      )}

      {/* Floating drawer nav — matches Hungry's exact style */}
      <nav
        id="tut-navbar"
        style={{
          position: 'fixed', left: 12, top: 12, zIndex: 55,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.30)',
          backdropFilter: 'blur(48px)',
          WebkitBackdropFilter: 'blur(48px)',
          border: '1px solid rgba(255,255,255,0.50)',
          boxShadow: '0 25px 50px rgba(37,99,235,0.15)',
          borderRadius: 32,
          width: 224,
          maxHeight: '92dvh',
          overflowY: 'auto',
          transition: 'opacity 0.3s ease, transform 0.3s ease',
          opacity: navOpen ? 1 : 0,
          transform: navOpen ? 'translateX(0) scale(1)' : 'translateX(-16px) scale(0.95)',
          pointerEvents: navOpen ? 'auto' : 'none',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.30)',
        }}>
          <span style={{ fontFamily: 'Pacifico, cursive', fontSize: 22, color: '#2563EB' }}>Roomies</span>
          <button onClick={() => setNavOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {/* Nav items */}
        <div style={{ padding: '8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {NAV.map(item => {
            const active = path === item.path
            const count = BADGE_PAGES.includes(item.path) ? (badges[item.path] ?? 0) : 0
            return (
              <button
                key={item.path}
                onClick={() => go(item.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px', borderRadius: 12,
                  background: active ? 'rgba(37,99,235,0.12)' : 'transparent',
                  color: active ? '#2563EB' : '#4B5563',
                  border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                  fontSize: 14, fontWeight: 700, textAlign: 'left', width: '100%',
                  transition: 'background 0.15s, color 0.15s',
                  position: 'relative',
                }}
                onMouseEnter={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.40)' }}
                onMouseLeave={e => { if (!active) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
              >
                <span style={{ flexShrink: 0, color: active ? '#2563EB' : '#9CA3AF' }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {count > 0 && (
                  <span style={{
                    background: '#E11D48', color: '#fff',
                    fontSize: 10, fontWeight: 800,
                    borderRadius: 999, padding: '2px 7px',
                    minWidth: 18, textAlign: 'center',
                  }}>
                    {count > 9 ? '9+' : count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </nav>
    </>
  )
}
