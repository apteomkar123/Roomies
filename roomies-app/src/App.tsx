import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
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
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
