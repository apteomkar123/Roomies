import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState } from 'react'
import type { ReactElement } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import { supabaseConfigured } from './lib/supabase'
import { HouseholdProvider } from './context/HouseholdContext'
import { TutorialProvider } from './context/TutorialContext'
import Tutorial from './components/Tutorial'
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

function PasswordResetScreen() {
  const { updatePassword } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)

  async function submit() {
    if (pw.length < 6) return setErr('Password must be at least 6 characters')
    if (pw !== pw2) return setErr('Passwords do not match')
    const { error } = await updatePassword(pw)
    if (error) setErr(error)
    else setMsg('Password updated! Redirecting…')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f8f9fb', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 400, background: 'rgba(255,255,255,0.6)', backdropFilter: 'blur(20px)', borderRadius: 24, padding: 36, border: '1px solid rgba(255,255,255,0.5)', boxShadow: '0 8px 32px rgba(0,0,0,0.08)' }}>
        <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 32, color: '#2563EB', marginBottom: 8 }}>Roomies</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 4 }}>Set new password</div>
        <div style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Choose a strong password for your account</div>
        {err && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{err}</div>}
        {msg && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '10px 14px', color: '#059669', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{msg}</div>}
        <div style={{ position: 'relative', marginBottom: 12 }}>
          <input className="glass-input" type={showPw ? 'text' : 'password'} placeholder="New password" value={pw} onChange={e => setPw(e.target.value)} style={{ paddingRight: 44 }} />
          <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex', alignItems: 'center' }}>
            {showPw
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <input className="glass-input" type={showPw2 ? 'text' : 'password'} placeholder="Confirm password" value={pw2} onChange={e => setPw2(e.target.value)} style={{ paddingRight: 44 }} onKeyDown={e => e.key === 'Enter' && submit()} />
          <button type="button" onClick={() => setShowPw2(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex', alignItems: 'center' }}>
            {showPw2
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            }
          </button>
        </div>
        <button className="btn-blue" onClick={submit}>Update Password</button>
      </div>
    </div>
  )
}

function AppRoutes() {
  const { session, profile, loading, needsPasswordReset } = useAuth()

  if (loading) return <Spinner />
  if (needsPasswordReset) return <PasswordResetScreen />

  const authed = !!session
  const hasHousehold = !!profile?.active_household_id

  // guard: redirect to /welcome if not authed or no household yet
  const guard = (el: ReactElement) => authed && hasHousehold ? el : <Navigate to="/welcome" replace />

  return (
    <HouseholdProvider>
      <TutorialProvider>
        <Tutorial />
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
      </TutorialProvider>
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
