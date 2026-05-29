import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import { HouseholdProvider } from './context/HouseholdContext'
import Onboarding   from './pages/Onboarding'
import Dashboard    from './pages/Dashboard'
import Chores       from './pages/Chores'
import Finance      from './pages/Finance'
import Notices      from './pages/Notices'
import Bookings     from './pages/Bookings'
import Maintenance  from './pages/Maintenance'
import Lockbox      from './pages/Lockbox'
import Guests       from './pages/Guests'
import Shopping     from './pages/Shopping'
import Pets         from './pages/Pets'
import More         from './pages/More'

const Spinner = () => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', gap: 16 }}>
    <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 40, color: '#2563EB' }}>Roomies</div>
    <div style={{ width: 32, height: 32, border: '3px solid #E0E7FF', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
)

function AppRoutes() {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />

  const authed = !!session
  const hasHousehold = !!profile?.household_id

  // guard: redirect to /welcome if not authed or no household yet
  const guard = (el: JSX.Element) => authed && hasHousehold ? el : <Navigate to="/welcome" replace />

  return (
    <HouseholdProvider>
      <Routes>
        <Route path="/welcome"     element={<Onboarding />} />
        <Route path="/"            element={guard(<Dashboard />)} />
        <Route path="/chores"      element={guard(<Chores />)} />
        <Route path="/finance"     element={guard(<Finance />)} />
        <Route path="/notices"     element={guard(<Notices />)} />
        <Route path="/bookings"    element={guard(<Bookings />)} />
        <Route path="/maintenance" element={guard(<Maintenance />)} />
        <Route path="/lockbox"     element={guard(<Lockbox />)} />
        <Route path="/guests"      element={guard(<Guests />)} />
        <Route path="/shopping"    element={guard(<Shopping />)} />
        <Route path="/pets"        element={guard(<Pets />)} />
        <Route path="/more"        element={guard(<More />)} />
        <Route path="*"            element={<Navigate to={authed && hasHousehold ? '/' : '/welcome'} replace />} />
      </Routes>
    </HouseholdProvider>
  )
}

export default function App() {
  if (!supabaseConfigured) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 40, color: '#2563EB', marginBottom: 16 }}>Roomies</div>
          <div style={{ background: 'rgba(244,63,94,0.08)', border: '1.5px solid rgba(244,63,94,0.25)', borderRadius: 16, padding: '20px 24px', color: '#BE123C' }}>
            <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Supabase not configured</div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: '#6B7280' }}>
              Add <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>VITE_SUPABASE_URL</code> and{' '}
              <code style={{ background: 'rgba(0,0,0,0.06)', padding: '2px 6px', borderRadius: 4 }}>VITE_SUPABASE_ANON_KEY</code> to your{' '}
              Netlify environment variables (Site Settings → Environment Variables).
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
