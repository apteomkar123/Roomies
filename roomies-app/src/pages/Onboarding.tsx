import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'

const AVATAR_OPTIONS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Mia',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Alex',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Sam',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Jordan',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=River',
]

function genInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function Onboarding() {
  const { user, profile, signInWithEmail, signUpWithEmail, signInWithGoogle, signInWithApple, sendPasswordReset, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(user ? 2 : 1)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(false)

  // Step 1 state
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [forgotMode, setForgotMode] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // Step 2 state
  const [username, setUsername] = useState(profile?.username ?? '')
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url ?? AVATAR_OPTIONS[0])

  // Step 3 state
  const [path, setPath] = useState<'create' | 'join' | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [codeValid, setCodeValid] = useState<boolean | null>(null)

  // Step 4A state (creator)
  const [quietStart, setQuietStart] = useState(22)
  const [quietEnd, setQuietEnd] = useState(8)
  const [hygieneScore, setHygieneScore] = useState(3)
  const [maxGuests, setMaxGuests] = useState(3)

  // Step 4B state
  const [joinHousehold, setJoinHousehold] = useState<{ id: string; title: string; agreement: any } | null>(null)

  // Step 5 (swipe)
  const [swiped, setSwiped] = useState(false)
  const [dragX, setDragX] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const next = () => setStep(s => s + 1)
  const setError = (msg: string) => { setErr(msg); setTimeout(() => setErr(''), 3000) }

  // Advance past sign-in if OAuth callback fires after initial render
  useEffect(() => {
    if (user && step === 1) setStep(2)
  }, [user])

  // ── Step 1: Auth ──────────────────────────────────────────────
  async function handleAuth() {
    setLoading(true)
    const fn = isSignUp ? signUpWithEmail : signInWithEmail
    const { error } = await fn(email, password)
    setLoading(false)
    if (error) return setError(error)
    next()
  }

  async function handleForgot() {
    if (!email.trim()) return setError('Enter your email address above first')
    setLoading(true)
    const { error } = await sendPasswordReset(email)
    setLoading(false)
    if (error) return setError(error)
    setResetSent(true)
  }

  // ── Step 2: Save profile ──────────────────────────────────────
  async function handleProfile() {
    if (!username.trim()) return setError('Username required')
    setLoading(true)
    const { error } = await supabase.from('profiles').update({ username: username.trim(), avatar_url: selectedAvatar }).eq('id', user!.id)
    setLoading(false)
    if (error) return setError(error.message)
    await refreshProfile()
    next()
  }

  // ── Step 3: Create household ──────────────────────────────────
  async function handleCreate() {
    setPath('create')
    next() // → step 4A
  }

  async function handleCheckInvite(code: string) {
    setInviteInput(code)
    if (code.length !== 6) { setCodeValid(null); return }
    const { data } = await supabase.from('households').select('id,title').eq('invite_code', code.toUpperCase()).single()
    if (data) {
      setCodeValid(true)
      const { data: ag } = await supabase.from('coliving_agreements').select('*').eq('household_id', data.id).single()
      setJoinHousehold({ id: data.id, title: data.title, agreement: ag })
    } else {
      setCodeValid(false)
    }
  }

  async function handleJoin() {
    if (!joinHousehold) return
    setPath('join')
    next() // → step 4B
  }

  // ── Step 4A: Finish creating ──────────────────────────────────
  async function handleFinishCreate() {
    setLoading(true)
    const invite = genInviteCode()
    const { data: hh, error } = await supabase
      .from('households')
      .insert({ title: `${username}'s Home`, invite_code: invite })
      .select().single()
    if (error || !hh) { setLoading(false); return setError(error?.message ?? 'Failed') }

    await Promise.all([
      supabase.from('coliving_agreements').insert({
        household_id: hh.id,
        quiet_start: `${quietStart}:00`,
        quiet_end: `${quietEnd}:00`,
        hygiene_score: hygieneScore,
        guest_overstay_rules: `Max ${maxGuests} consecutive nights`,
      }),
      supabase.from('household_members').insert({ household_id: hh.id, profile_id: user!.id, role: 'Administrator' }),
      supabase.from('profiles').update({ household_id: hh.id }).eq('id', user!.id),
    ])
    await refreshProfile()
    setLoading(false)
    next() // → step 5
  }

  // ── Step 4B: Accept joining ────────────────────────────────────
  async function handleFinishJoin() {
    if (!joinHousehold) return
    setLoading(true)
    await Promise.all([
      supabase.from('household_members').insert({ household_id: joinHousehold.id, profile_id: user!.id, role: 'Tenant' }),
      supabase.from('profiles').update({ household_id: joinHousehold.id }).eq('id', user!.id),
    ])
    await refreshProfile()
    setLoading(false)
    next() // → step 5
  }

  // ── Step 5: Swipe to sign ─────────────────────────────────────
  function onMouseDown(e: React.MouseEvent) {
    dragging.current = true
    const startX = e.clientX
    const track = trackRef.current!
    const maxDrag = track.clientWidth - 56

    const onMove = (mv: MouseEvent) => {
      if (!dragging.current) return
      const dx = Math.min(Math.max(mv.clientX - startX, 0), maxDrag)
      setDragX(dx)
      if (dx >= maxDrag - 4) { dragging.current = false; handleSign() }
    }
    const onUp = () => { dragging.current = false; setDragX(0) }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp, { once: true })
  }

  function onTouchStart(e: React.TouchEvent) {
    const startX = e.touches[0].clientX
    const track = trackRef.current!
    const maxDrag = track.clientWidth - 56

    const onMove = (mv: TouchEvent) => {
      const dx = Math.min(Math.max(mv.touches[0].clientX - startX, 0), maxDrag)
      setDragX(dx)
      if (dx >= maxDrag - 4) handleSign()
    }
    const onEnd = () => setDragX(0)
    track.addEventListener('touchmove', onMove)
    track.addEventListener('touchend', onEnd, { once: true })
  }

  async function handleSign() {
    if (swiped) return
    setSwiped(true)
    await supabase.from('agreement_signatures').upsert({
      household_id: profile!.household_id,
      user_id: user!.id,
    })
    setTimeout(() => navigate('/'), 800)
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <CanvasBg />

      {/* Step indicator */}
      {step > 1 && (
        <div style={{ position: 'fixed', top: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{
              width: 8, height: 8, borderRadius: '50%',
              background: step > i ? '#2563EB' : step === i ? '#8B5CF6' : 'rgba(0,0,0,0.15)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>
      )}

      <GlassPanel style={{ width: '100%', maxWidth: 420, padding: 36, position: 'relative' }}>
        {err && (
          <div style={{ background: 'rgba(244,63,94,0.12)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 12, padding: '10px 16px', marginBottom: 20, color: '#E11D48', fontSize: 14, fontWeight: 600 }}>
            {err}
          </div>
        )}

        {/* ── STEP 1: Auth ── */}
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Pacifico, cursive', fontSize: 48, background: 'linear-gradient(135deg, #2563EB, #8B5CF6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
              Roomies
            </div>
            <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 32 }}>Your co-living command center</p>

            <button
              onClick={signInWithGoogle}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              Continue with Google
            </button>

            <button
              onClick={signInWithApple}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, border: '1.5px solid rgba(0,0,0,0.12)', background: '#000', cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 16, fontFamily: 'inherit', color: '#fff' }}
            >
              <svg width="18" height="22" viewBox="0 0 814 1000" fill="white"><path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-37.5-155.5-127.4C46 790.9 0 663.4 0 541.5c0-207 134.7-316.8 267.4-316.8 49.8 0 97.7 19.4 131.7 19.4 31.3 0 86.3-22.2 148.9-22.2 23.7 0 108.2 2.2 168.1 80.4zm-172.8-185.5c28.1-35.2 48.2-84.2 48.2-133.2 0-6.8-.6-13.7-1.9-19.3-45.4 1.9-99.7 30.6-131.7 68.8-26.3 30-50.8 79-50.8 128.6 0 7.4 1.3 14.8 1.9 17.1 3.2.6 8.4 1.3 13.6 1.3 40.7 0 91.7-27.4 120.7-63.3z"/></svg>
              Continue with Apple
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
              <span style={{ color: '#9CA3AF', fontSize: 13 }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.1)' }} />
            </div>

            <input className="glass-input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} style={{ marginBottom: 12 }} />

            {forgotMode ? (
              <>
                {resetSent
                  ? <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 12, padding: '12px 16px', color: '#059669', fontWeight: 600, fontSize: 14, marginBottom: 16 }}>
                      Check your email for a reset link ✓
                    </div>
                  : <button className="btn-mint" onClick={handleForgot} disabled={loading} style={{ marginBottom: 12 }}>{loading ? '…' : 'Send Reset Link'}</button>
                }
                <button onClick={() => { setForgotMode(false); setResetSent(false) }} style={{ background: 'none', border: 'none', color: '#6B7280', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ← Back to sign in
                </button>
              </>
            ) : (
              <>
                <div style={{ position: 'relative', marginBottom: 20 }}>
                  <input className="glass-input" type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={{ paddingRight: 44 }} onKeyDown={e => e.key === 'Enter' && handleAuth()} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex', alignItems: 'center' }}>
                    {showPassword
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                <button className="btn-blue" onClick={handleAuth} disabled={loading}>{loading ? '…' : isSignUp ? 'Create Account' : 'Sign In'}</button>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <button onClick={() => setIsSignUp(!isSignUp)} style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                  </button>
                  {!isSignUp && (
                    <button onClick={() => setForgotMode(true)} style={{ background: 'none', border: 'none', color: '#9CA3AF', fontWeight: 600, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Forgot password?
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── STEP 2: Profile ── */}
        {step === 2 && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Your Profile</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Pick a handle and avatar</p>
            <input className="glass-input" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} style={{ marginBottom: 24 }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 28 }}>
              {AVATAR_OPTIONS.map(av => (
                <div key={av} onClick={() => setSelectedAvatar(av)} style={{ cursor: 'pointer', borderRadius: 16, overflow: 'hidden', border: selectedAvatar === av ? '3px solid #2563EB' : '3px solid transparent', boxShadow: selectedAvatar === av ? '0 0 20px rgba(37,99,235,0.4)' : undefined, transition: 'all 0.2s' }}>
                  <img src={av} alt="avatar" style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
                </div>
              ))}
            </div>
            <button className="btn-blue" onClick={handleProfile} disabled={loading}>{loading ? '…' : 'Continue'}</button>
          </div>
        )}

        {/* ── STEP 3: Join or Create ── */}
        {step === 3 && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.5px' }}>Your Home</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Create a household or join one</p>

            <GlassPanel style={{ padding: 24, marginBottom: 16, cursor: 'pointer', border: '1.5px solid rgba(37,99,235,0.25)' }} onClick={handleCreate}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#2563EB,#3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🏠</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Create a Household</div>
                  <div style={{ color: '#6B7280', fontSize: 13 }}>Set up rules &amp; invite roommates</div>
                </div>
              </div>
            </GlassPanel>

            <GlassPanel style={{ padding: 24, border: `1.5px solid ${codeValid === true ? 'rgba(16,185,129,0.5)' : codeValid === false ? 'rgba(244,63,94,0.4)' : 'rgba(16,185,129,0.25)'}`, transition: 'border-color 0.3s', boxShadow: codeValid === true ? '0 0 20px rgba(16,185,129,0.2)' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg,#10B981,#34D399)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔑</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Join a Household</div>
                  <div style={{ color: '#6B7280', fontSize: 13 }}>Enter your 6-digit invite code</div>
                </div>
              </div>
              <input
                className="glass-input"
                placeholder="ABC123"
                maxLength={6}
                value={inviteInput}
                onChange={e => handleCheckInvite(e.target.value)}
                style={{ textTransform: 'uppercase', letterSpacing: '0.2em', textAlign: 'center', fontSize: 20, fontWeight: 800, marginBottom: codeValid === true ? 14 : 0 }}
              />
              {codeValid === true && <button className="btn-mint" onClick={handleJoin}>Join "{joinHousehold?.title}"</button>}
              {codeValid === false && <div style={{ color: '#E11D48', fontSize: 13, fontWeight: 600, marginTop: 8 }}>Code not found. Check with your roommate.</div>}
            </GlassPanel>
          </div>
        )}

        {/* ── STEP 4A: Creator rules ── */}
        {step === 4 && path === 'create' && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.5px' }}>House Rules</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 28 }}>Set the baseline for your home</p>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
                Quiet hours start: <span style={{ color: '#2563EB' }}>{quietStart}:00</span>
              </label>
              <input type="range" min={18} max={23} value={quietStart} onChange={e => setQuietStart(+e.target.value)} style={{ width: '100%', accentColor: '#2563EB' }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
                Quiet hours end: <span style={{ color: '#2563EB' }}>{quietEnd}:00</span>
              </label>
              <input type="range" min={5} max={12} value={quietEnd} onChange={e => setQuietEnd(+e.target.value)} style={{ width: '100%', accentColor: '#2563EB' }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
                Hygiene baseline: <span style={{ color: '#10B981' }}>{hygieneScore}/5</span>
              </label>
              <input type="range" min={1} max={5} value={hygieneScore} onChange={e => setHygieneScore(+e.target.value)} style={{ width: '100%', accentColor: '#10B981' }} />
            </div>

            <div style={{ marginBottom: 28 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
                Max guest nights: <span style={{ color: '#8B5CF6' }}>{maxGuests}</span>
              </label>
              <input type="range" min={1} max={14} value={maxGuests} onChange={e => setMaxGuests(+e.target.value)} style={{ width: '100%', accentColor: '#8B5CF6' }} />
            </div>

            <button className="btn-blue" onClick={handleFinishCreate} disabled={loading}>{loading ? '…' : 'Create Household'}</button>
          </div>
        )}

        {/* ── STEP 4B: Joiner rules review ── */}
        {step === 4 && path === 'join' && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.5px' }}>House Rules</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Review before you move in</p>

            {joinHousehold?.agreement && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 28 }}>
                {[
                  { label: 'Quiet hours', value: `${joinHousehold.agreement.quiet_start} – ${joinHousehold.agreement.quiet_end}`, icon: '🌙' },
                  { label: 'Hygiene score', value: `${joinHousehold.agreement.hygiene_score}/5`, icon: '✨' },
                  { label: 'Guest policy', value: joinHousehold.agreement.guest_overstay_rules, icon: '🏡' },
                ].map(rule => (
                  <div key={rule.label} style={{ background: 'rgba(255,255,255,0.6)', borderRadius: 14, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, border: '1px solid rgba(255,255,255,0.5)', animation: 'orbFloat 4s ease-in-out infinite' }}>
                    <span style={{ fontSize: 22 }}>{rule.icon}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#6B7280', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{rule.label}</div>
                      <div style={{ fontWeight: 800, fontSize: 16 }}>{rule.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <button className="btn-mint" onClick={handleFinishJoin} disabled={loading}>{loading ? '…' : 'Looks good, join!'}</button>
          </div>
        )}

        {/* ── STEP 5: Swipe to sign ── */}
        {step === 5 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>✍️</div>
            <h2 style={{ fontWeight: 800, fontSize: 24, margin: '0 0 8px', letterSpacing: '-0.5px' }}>Sign the Agreement</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 36 }}>Swipe to digitally sign and enter your home</p>

            <div
              ref={trackRef}
              style={{
                position: 'relative', height: 56, borderRadius: 999,
                background: swiped ? 'linear-gradient(135deg,#10B981,#34D399)' : 'rgba(37,99,235,0.08)',
                border: '1.5px solid rgba(37,99,235,0.2)',
                overflow: 'hidden', cursor: 'pointer', userSelect: 'none',
              }}
            >
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: swiped ? 'white' : '#9CA3AF', fontWeight: 700, fontSize: 14, pointerEvents: 'none' }}>
                {swiped ? '✓ Signed!' : 'Slide to sign →'}
              </div>
              {!swiped && (
                <div
                  onMouseDown={onMouseDown}
                  onTouchStart={onTouchStart}
                  style={{
                    position: 'absolute', left: dragX, top: 4, width: 48, height: 48,
                    borderRadius: 999, background: 'linear-gradient(135deg,#2563EB,#8B5CF6)',
                    boxShadow: '0 4px 16px rgba(37,99,235,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', fontSize: 20, cursor: 'grab', transition: 'left 0.05s',
                  }}
                >
                  →
                </div>
              )}
            </div>
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
