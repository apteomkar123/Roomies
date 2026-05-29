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

function AppRoutes() {
  const { session, profile, loading } = useAuth()

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 36, background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Roomies
        </div>
      </div>
    )
  }

  // Not authenticated → onboarding
  if (!session) return <Navigate to="/welcome" replace />

  // Authenticated but no household → onboarding continuation
  const hasHousehold = !!profile?.household_id

  return (
    <HouseholdProvider>
      <Routes>
        <Route path="/welcome"     element={<Onboarding />} />
        <Route path="/"            element={hasHousehold ? <Dashboard />   : <Navigate to="/welcome" replace />} />
        <Route path="/chores"      element={hasHousehold ? <Chores />      : <Navigate to="/welcome" replace />} />
        <Route path="/finance"     element={hasHousehold ? <Finance />     : <Navigate to="/welcome" replace />} />
        <Route path="/notices"     element={hasHousehold ? <Notices />     : <Navigate to="/welcome" replace />} />
        <Route path="/bookings"    element={hasHousehold ? <Bookings />    : <Navigate to="/welcome" replace />} />
        <Route path="/maintenance" element={hasHousehold ? <Maintenance /> : <Navigate to="/welcome" replace />} />
        <Route path="/lockbox"     element={hasHousehold ? <Lockbox />     : <Navigate to="/welcome" replace />} />
        <Route path="/guests"      element={hasHousehold ? <Guests />      : <Navigate to="/welcome" replace />} />
        <Route path="/shopping"    element={hasHousehold ? <Shopping />    : <Navigate to="/welcome" replace />} />
        <Route path="/pets"        element={hasHousehold ? <Pets />        : <Navigate to="/welcome" replace />} />
        <Route path="/more"        element={hasHousehold ? <More />        : <Navigate to="/welcome" replace />} />
        <Route path="*"            element={<Navigate to="/" replace />} />
      </Routes>
    </HouseholdProvider>
  )
}

export default function App() {
  if (!supabaseConfigured) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', padding: 24 }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 40, background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 16 }}>Roomies</div>
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
