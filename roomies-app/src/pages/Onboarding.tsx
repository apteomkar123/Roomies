import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import type { CoLivingAgreement } from '../types'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'

type PhotoDialog = 'import-or-new' | 'apply-all' | null

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

function fmt12(h: number) {
  const ampm = h < 12 ? 'AM' : 'PM'
  const hr = h % 12 || 12
  return `${hr}:00 ${ampm}`
}

function parseQuietTime(s: string) {
  const h = parseInt(s.split(':')[0])
  return isNaN(h) ? s : fmt12(h)
}

export default function Onboarding() {
  const { user, profile, signInWithEmail, signUpWithEmail, signInWithLyfeWare, sendPasswordReset, refreshProfile } = useAuth()
  const navigate = useNavigate()

  // Detect invite code from query param (e.g. /welcome?invite=ABC123)
  const inviteFromUrl = new URLSearchParams(window.location.search).get('invite')?.toUpperCase() ?? ''

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

  // Step 2 state — pre-fill from LyfeWare profile if available
  const [username, setUsername] = useState(profile?.display_name || profile?.username || '')
  const [selectedAvatar, setSelectedAvatar] = useState(profile?.avatar_url ?? AVATAR_OPTIONS[0])
  const [customPhotoUrl, setCustomPhotoUrl] = useState<string | null>(null) // uploaded photo
  const [photoDialog, setPhotoDialog] = useState<PhotoDialog>(null)
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const photoFileRef = useRef<HTMLInputElement>(null)

  // Step 3 state
  const [path, setPath] = useState<'create' | 'join' | null>(null)
  const [inviteInput, setInviteInput] = useState('')
  const [codeValid, setCodeValid] = useState<boolean | null>(null)

  // Step 4A state (creator)
  const [householdType, setHouseholdType] = useState<'shared' | 'homebase-only'>('shared')
  const [quietStart, setQuietStart] = useState(22)
  const [quietEnd, setQuietEnd] = useState(8)
  const [hygieneScore, setHygieneScore] = useState(3)
  const [maxGuests, setMaxGuests] = useState(3)

  // Step 4B state
  const [joinHousehold, setJoinHousehold] = useState<{ id: string; name: string; agreement: CoLivingAgreement | null } | null>(null)

  // Step 5 (swipe)
  const [swiped, setSwiped] = useState(false)
  const [dragX, setDragX] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const next = () => setStep(s => s + 1)
  const setError = (msg: string) => { setErr(msg); setTimeout(() => setErr(''), 3000) }

  // Redirect if user already has a household (prevents re-running onboarding on every open)
  useEffect(() => {
    if (user && profile?.active_household_id) navigate('/', { replace: true })
  }, [user, profile?.active_household_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Advance past sign-in if OAuth callback fires after initial render
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (user && step === 1) setStep(2)
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  // Sync LyfeWare username/display_name once profile loads (handles SSO where profile arrives async)
  useEffect(() => {
    const name = profile?.display_name || profile?.username || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (name && !username) setUsername(name)
  }, [profile?.username, profile?.display_name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-populate invite code from URL param once user reaches step 3
  useEffect(() => {
    if (step === 3 && inviteFromUrl && !inviteInput) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInviteInput(inviteFromUrl)
      handleCheckInvite(inviteFromUrl)
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-import LyfeWare profile photo when arriving at step 2
  useEffect(() => {
    if (step === 2 && profile?.avatar_url && !customPhotoUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCustomPhotoUrl(profile.avatar_url)
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPhotoDialog('import-or-new')
    }
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Step 2: Photo upload helpers ─────────────────────────────
  function handlePhotoButton() {
    if (profile?.avatar_url) {
      setPhotoDialog('import-or-new')
    } else {
      photoFileRef.current?.click()
    }
  }

  async function uploadPhoto(file: File, type: 'global' | 'homebase'): Promise<string | null> {
    if (!user?.id) return null
    const ext = file.name.split('.').pop() ?? 'jpg'
    const filename = type === 'global' ? `avatar.${ext}` : `homebase.${ext}`
    const path = `${user.id}/${filename}`
    const { error } = await supabase.storage.from('user-avatars').upload(path, file, { upsert: true })
    if (error) return null
    const { data: { publicUrl } } = supabase.storage.from('user-avatars').getPublicUrl(path)
    const col = type === 'global' ? 'avatar_url' : 'homebase_avatar_url'
    await supabase.from('profiles').update({ [col]: publicUrl }).eq('id', user.id)
    return publicUrl
  }

  function handleOnboardPhotoChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const preview = URL.createObjectURL(file)
    setCustomPhotoUrl(preview)
    if (!profile?.avatar_url) {
      setPendingPhotoFile(file)
      setPhotoDialog('apply-all')
    } else {
      setPhotoDialog(null)
      setPendingPhotoFile(file)
    }
  }

  async function handleImportGlobal() {
    setCustomPhotoUrl(profile?.avatar_url ?? null)
    setPhotoDialog(null)
  }

  // ── Step 2: Save profile ──────────────────────────────────────
  async function handleProfile() {
    if (!username.trim()) return setError('Username required')
    setLoading(true)

    // Start with DiceBear/real URL — never persist a blob: URL to the database
    let finalAvatar = (customPhotoUrl && !customPhotoUrl.startsWith('blob:'))
      ? customPhotoUrl
      : selectedAvatar

    if (pendingPhotoFile) {
      const url = await uploadPhoto(pendingPhotoFile, 'homebase')
      // Only promote to global avatar_url if the user has no existing LyfeWare avatar;
      // if they do, homebase_avatar_url is already set inside uploadPhoto() — preserve the global one.
      if (url && !profile?.avatar_url) finalAvatar = url
      setPendingPhotoFile(null)
    }

    const { error } = await supabase.from('profiles').update({ username: username.trim(), avatar_url: finalAvatar }).eq('id', user!.id)
    setLoading(false)
    if (error) return setError(error.message)
    await refreshProfile()
    next()
  }

  async function handleApplyAllOnboard() {
    if (!pendingPhotoFile) return
    setPhotoUploading(true)
    const url = await uploadPhoto(pendingPhotoFile, 'global')
    if (url) setCustomPhotoUrl(url)
    setPendingPhotoFile(null)
    setPhotoUploading(false)
    setPhotoDialog(null)
  }

  async function handleApplyHomeBaseOnboard() {
    if (!pendingPhotoFile) return
    setPhotoUploading(true)
    const url = await uploadPhoto(pendingPhotoFile, 'homebase')
    if (url) setCustomPhotoUrl(url)
    setPendingPhotoFile(null)
    setPhotoUploading(false)
    setPhotoDialog(null)
  }

  // ── Step 3: Create household ──────────────────────────────────
  async function handleCreate() {
    setPath('create')
    next() // → step 4A
  }

  async function handleCheckInvite(code: string) {
    setInviteInput(code)
    if (code.length !== 6) { setCodeValid(null); return }
    const { data } = await supabase.from('households').select('id,name').eq('invite_code', code.toUpperCase()).single()
    if (data) {
      setCodeValid(true)
      const { data: ag } = await supabase.from('coliving_agreements').select('*').eq('household_id', data.id).single()
      setJoinHousehold({ id: data.id, name: data.name, agreement: ag })
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
    // Pre-generate the UUID so we never need a post-insert SELECT.
    const hhId = crypto.randomUUID()
    const invite = genInviteCode()
    const { error } = await supabase
      .from('households')
      .insert({ id: hhId, name: `${username}'s Home`, invite_code: invite, created_by: user!.id })
    if (error) { setLoading(false); return setError(error.message) }

    // For "homebase-only", create a separate Pantry household so Pantry
    // doesn't share the HomeBase household (hungry_household_id overrides active_household_id in Pantry).
    let pantryHhId: string | null = null
    if (householdType === 'homebase-only') {
      pantryHhId = crypto.randomUUID()
      await supabase.from('households').insert({
        id: pantryHhId,
        name: `${username}'s Pantry`,
        invite_code: genInviteCode(),
        created_by: user!.id,
      })
    }

    const profileUpdate = pantryHhId
      ? { active_household_id: hhId, hungry_household_id: pantryHhId }
      : { active_household_id: hhId }

    await Promise.all([
      supabase.from('coliving_agreements').insert({
        household_id: hhId,
        quiet_start: `${quietStart}:00`,
        quiet_end: `${quietEnd}:00`,
        hygiene_score: hygieneScore,
        guest_overstay_rules: `Max ${maxGuests} consecutive nights`,
      }),
      supabase.from('household_members').insert({ household_id: hhId, profile_id: user!.id, role: 'Administrator' }),
      ...(pantryHhId ? [supabase.from('household_members').insert({ household_id: pantryHhId, profile_id: user!.id, role: 'Administrator' })] : []),
      supabase.from('profiles').update(profileUpdate).eq('id', user!.id),
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
      supabase.from('profiles').update({ active_household_id: joinHousehold.id }).eq('id', user!.id),
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
      household_id: profile!.active_household_id,
      user_id: user!.id,
    })
    setTimeout(() => navigate('/'), 800)
  }

  // Prevent flash of onboarding when user already has a household — navigate away is pending
  if (user && profile?.active_household_id) return null

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
              HomeBase
            </div>
            <p style={{ color: '#6B7280', fontSize: 15, marginBottom: 32 }}>Your co-living command center</p>

            <p style={{ fontSize: 12, fontWeight: 600, color: '#8B5CF6', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 10px' }}>Sync your LyfeWare apps!</p>

            <button
              onClick={signInWithLyfeWare}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, padding: '14px 20px', borderRadius: 14, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', cursor: 'pointer', fontWeight: 700, fontSize: 15, marginBottom: 12, fontFamily: 'inherit', color: '#fff' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="rgba(255,255,255,0.2)"/><path d="M8 12h8M12 8l4 4-4 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Sign in with LyfeWare
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
                  <button onClick={() => { setIsSignUp(v => !v); setEmail(''); setPassword('') }} style={{ background: 'none', border: 'none', color: '#2563EB', fontWeight: 600, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
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
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Pick a handle and photo</p>
            <input className="glass-input" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} style={{ marginBottom: 20 }} />

            {/* Profile Photo */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Profile Photo</div>

              {/* Upload custom photo option */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  {customPhotoUrl
                    ? <img src={customPhotoUrl} alt="" style={{ width: 56, height: 56, borderRadius: 14, objectFit: 'cover', border: '3px solid #2563EB' }} />
                    : <div onClick={handlePhotoButton} style={{ width: 56, height: 56, borderRadius: 14, border: '2px dashed rgba(37,99,235,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 22, background: 'rgba(37,99,235,0.04)' }}>📷</div>
                  }
                  {customPhotoUrl && (
                    <button onClick={handlePhotoButton} style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, background: '#2563EB', border: '2px solid white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: 'white', fontWeight: 900 }}>
                      {photoUploading ? '…' : '✎'}
                    </button>
                  )}
                  <input ref={photoFileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleOnboardPhotoChosen} />
                </div>

                {photoDialog === 'import-or-new' ? (
                  <div style={{ flex: 1, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>You have an LyfeWare photo. Use it here?</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleImportGlobal} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, Use It</button>
                      <button onClick={() => { setPhotoDialog(null); photoFileRef.current?.click() }} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(37,99,235,0.3)', background: 'transparent', color: '#2563EB', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Choose Different</button>
                    </div>
                  </div>
                ) : photoDialog === 'apply-all' ? (
                  <div style={{ flex: 1, background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: 12, padding: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8 }}>Apply to all LyfeWare apps?</div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={handleApplyAllOnboard} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: 'none', background: '#2563EB', color: '#fff', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, All Apps</button>
                      <button onClick={handleApplyHomeBaseOnboard} style={{ flex: 1, padding: '6px 0', borderRadius: 8, border: '1px solid rgba(37,99,235,0.3)', background: 'transparent', color: '#2563EB', fontWeight: 700, fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Just HomeBase</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={handlePhotoButton} style={{ background: 'none', border: '1px dashed rgba(37,99,235,0.3)', borderRadius: 12, padding: '10px 16px', cursor: 'pointer', color: '#6B7280', fontSize: 13, fontWeight: 600, fontFamily: 'inherit' }}>
                    {customPhotoUrl ? 'Change Photo' : 'Upload Custom Photo'}
                  </button>
                )}
              </div>

              {/* Or choose an avatar illustration */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>Or choose an avatar</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                {AVATAR_OPTIONS.map(av => (
                  <div key={av} onClick={() => { setSelectedAvatar(av); setCustomPhotoUrl(null) }} style={{ cursor: 'pointer', borderRadius: 14, overflow: 'hidden', border: !customPhotoUrl && selectedAvatar === av ? '3px solid #2563EB' : '3px solid transparent', boxShadow: !customPhotoUrl && selectedAvatar === av ? '0 0 16px rgba(37,99,235,0.35)' : undefined, transition: 'all 0.2s', opacity: customPhotoUrl ? 0.45 : 1 }}>
                    <img src={av} alt="avatar" style={{ width: '100%', aspectRatio: '1', display: 'block' }} />
                  </div>
                ))}
              </div>
            </div>

            <button className="btn-blue" onClick={handleProfile} disabled={loading || photoUploading}>{loading ? '…' : 'Continue'}</button>
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
              {codeValid === true && <button className="btn-mint" onClick={handleJoin}>Join "{joinHousehold?.name}"</button>}
              {codeValid === false && <div style={{ color: '#E11D48', fontSize: 13, fontWeight: 600, marginTop: 8 }}>Code not found. Check with your roommate.</div>}
            </GlassPanel>
          </div>
        )}

        {/* ── STEP 4A: Creator rules ── */}
        {step === 4 && path === 'create' && (
          <div>
            <h2 style={{ fontWeight: 800, fontSize: 24, margin: '0 0 6px', letterSpacing: '-0.5px' }}>House Rules</h2>
            <p style={{ color: '#6B7280', fontSize: 14, marginBottom: 24 }}>Set the baseline for your home</p>

            {/* Household type */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontWeight: 700, fontSize: 13, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Household Type</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setHouseholdType('shared')}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 14, border: `2px solid ${householdType === 'shared' ? '#2563EB' : 'rgba(0,0,0,0.1)'}`, background: householdType === 'shared' ? 'rgba(37,99,235,0.08)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: householdType === 'shared' ? '#2563EB' : '#374151' }}>🍽️ Shared with Pantry</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>Grocery & pantry synced across apps</div>
                </button>
                <button
                  type="button"
                  onClick={() => setHouseholdType('homebase-only')}
                  style={{ flex: 1, padding: '12px 14px', borderRadius: 14, border: `2px solid ${householdType === 'homebase-only' ? '#8B5CF6' : 'rgba(0,0,0,0.1)'}`, background: householdType === 'homebase-only' ? 'rgba(139,92,246,0.08)' : 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.2s' }}
                >
                  <div style={{ fontWeight: 800, fontSize: 13, color: householdType === 'homebase-only' ? '#8B5CF6' : '#374151' }}>🏠 HomeBase Only</div>
                  <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3 }}>Keep Pantry household separate</div>
                </button>
              </div>
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
                Quiet hours start: <span style={{ color: '#2563EB' }}>{fmt12(quietStart)}</span>
              </label>
              <input type="range" min={18} max={23} value={quietStart} onChange={e => setQuietStart(+e.target.value)} style={{ width: '100%', accentColor: '#2563EB' }} />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ fontWeight: 700, fontSize: 14, display: 'block', marginBottom: 8 }}>
                Quiet hours end: <span style={{ color: '#2563EB' }}>{fmt12(quietEnd)}</span>
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
                  { label: 'Quiet hours', value: `${parseQuietTime(joinHousehold.agreement.quiet_start)} – ${parseQuietTime(joinHousehold.agreement.quiet_end)}`, icon: '🌙' },
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
