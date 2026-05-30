import { useLocation, useNavigate } from 'react-router-dom'

const NAV = [
  { path: '/',            icon: '⌂',  label: 'Home'    },
  { path: '/chores',      icon: '✓',  label: 'Chores'  },
  { path: '/finance',     icon: '$',  label: 'Finance' },
  { path: '/notices',     icon: '📢', label: 'Notices' },
  { path: '/bookings',    icon: '📅', label: 'Book'    },
  { path: '/maintenance', icon: '🔧', label: 'Fix'     },
  { path: '/more',        icon: '···', label: 'More'   },
]

export default function NavBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const path = location.pathname

  return (
    <nav id="tut-navbar" className="nav-capsule" style={{ width: 'calc(100% - 32px)', maxWidth: 600 }}>
      {NAV.map(item => (
        <button
          key={item.path}
          className={`nav-item ${path === item.path ? 'active' : ''}`}
          onClick={() => navigate(item.path)}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          <span style={{ fontSize: 18, lineHeight: 1 }}>{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  )
}
