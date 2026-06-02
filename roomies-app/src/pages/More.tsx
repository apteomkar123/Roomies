import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { supabase } from '../lib/supabase'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'

type PhotoDialog = 'import-or-new' | 'apply-all' | null

interface HouseholdRow { id: string; name: string; invite_code: string; created_by: string | null }

function genInviteCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export default function More() {
  const { profile, user, signOut, refreshProfile, updateAvatar } = useAuth()
  const { household } = useHousehold()

  const [photoDialog, setPhotoDialog] = useState<PhotoDialog>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const [myHouseholds, setMyHouseholds] = useState<HouseholdRow[]>([])
  const [showJoinNew, setShowJoinNew] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [newHouseholdName, setNewHouseholdName] = useState('')
  const [hhLoading, setHhLoading] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [deleteHHConfirm, setDeleteHHConfirm] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    loadMyHouseholds()
  }, [user]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMyHouseholds() {
    if (!user) return
    const { data } = await supabase
      .from('household_members')
      .select('household_id, households(id, name, invite_code, created_by)')
      .eq('profile_id', user.id)
    if (data) {
      setMyHouseholds(
        data
          .map((row: { households: HouseholdRow | HouseholdRow[] | null }) => Array.isArray(row.households) ? row.households[0] ?? null : row.households)
          .filter((h): h is HouseholdRow => h !== null)
      )
    }
  }

  async function switchHousehold(hhId: string) {
    if (!user || hhId === profile?.active_household_id) return
    setHhLoading(true)
    await supabase.from('profiles').update({ active_household_id: hhId }).eq('id', user.id)
    supabase.from('cross_app_activity').insert({
      user_id: user.id, app: 'roomies', activity_type: 'household_switched', is_public: false,
      payload: { new_household_id: hhId },
    }).then(() => {})
    await refreshProfile()
    setHhLoading(false)
  }

  async function leaveHousehold(hhId: string) {
    if (!user) return
    setHhLoading(true)
    await supabase.from('household_members').delete().eq('household_id', hhId).eq('profile_id', user.id)
    // Switch active household if this was the active one
    if (profile?.active_household_id === hhId) {
      const remaining = myHouseholds.filter(h => h.id !== hhId)
      const nextId = remaining[0]?.id ?? null
      await supabase.from('profiles').update({ active_household_id: nextId }).eq('id', user.id)
    }
    await refreshProfile()
    loadMyHouseholds()
    setDeleteConfirm(null)
    setHhLoading(false)
  }

  async function deleteHousehold(hhId: string) {
    if (!user) return
    setHhLoading(true)
    await supabase.from('households').delete().eq('id', hhId)
    // profiles.active_household_id is ON DELETE SET NULL so DB handles clearing it,
    // but we still need to refresh local state.
    await refreshProfile()
    loadMyHouseholds()
    setDeleteHHConfirm(null)
    setHhLoading(false)
  }

  async function joinNewHousehold() {
    if (!joinCode.trim() || !user) return
    setHhLoading(true); setJoinError('')
    const { data: hh } = await supabase.from('households').select('id, name, invite_code').eq('invite_code', joinCode.toUpperCase()).single()
    if (!hh) { setJoinError('Code not found. Check with your roommate.'); setHhLoading(false); return }
    const { error } = await supabase.from('household_members').insert({ household_id: hh.id, profile_id: user.id, role: 'Tenant' })
    if (error && error.code !== '23505') { setJoinError(error.message); setHhLoading(false); return }
    await supabase.from('profiles').update({ active_household_id: hh.id }).eq('id', user.id)
    await refreshProfile()
    loadMyHouseholds()
    setJoinCode(''); setShowJoinNew(false)
    setHhLoading(false)
  }

  async function createNewHousehold() {
    if (!newHouseholdName.trim() || !user) return
    setHhLoading(true)
    const hhId = crypto.randomUUID()
    const invite = genInviteCode()
    const { error } = await supabase.from('households').insert({ id: hhId, name: newHouseholdName.trim(), invite_code: invite, created_by: user.id })
    if (error) { setHhLoading(false); return }
    await Promise.all([
      supabase.from('household_members').insert({ household_id: hhId, profile_id: user.id, role: 'Administrator' }),
      supabase.from('profiles').update({ active_household_id: hhId }).eq('id', user.id),
    ])
    supabase.from('cross_app_activity').insert({
      user_id: user.id, app: 'roomies', activity_type: 'household_created', is_public: false,
      payload: { household_id: hhId, name: newHouseholdName.trim() },
    }).then(() => {})
    await refreshProfile()
    loadMyHouseholds()
    setNewHouseholdName(''); setShowCreateNew(false)
    setHhLoading(false)
  }

  async function rerunTutorial() {
    if (!user) return
    await supabase.from('profiles').update({ has_completed_roomies_tutorial: false }).eq('id', user.id)
    await refreshProfile()
  }

  function handlePhotoButton() {
    if (profile?.avatar_url) setPhotoDialog('import-or-new')
    else fileRef.current?.click()
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!profile?.avatar_url) {
      setPendingFile(file)
      setPhotoDialog('apply-all')
    } else {
      setPhotoUploading(true)
      await updateAvatar(file, 'roomies')
      setPhotoUploading(false)
      setPhotoDialog(null)
    }
  }

  async function handleImportGlobal() {
    if (!user) return
    setPhotoUploading(true)
    await supabase.from('profiles').update({ roomies_avatar_url: null }).eq('id', user.id)
    await refreshProfile()
    setPhotoUploading(false)
    setPhotoDialog(null)
  }

  async function handleApplyAll() {
    if (!pendingFile) return
    setPhotoUploading(true)
    await updateAvatar(pendingFile, 'global')
    setPendingFile(null)
    setPhotoUploading(false)
    setPhotoDialog(null)
  }

  async function handleApplyRoomiesOnly() {
    if (!pendingFile) return
    setPhotoUploading(true)
    await updateAvatar(pendingFile, 'roomies')
    setPendingFile(null)
    setPhotoUploading(false)
    setPhotoDialog(null)
  }

  const photo = profile?.roomies_avatar_url || profile?.avatar_url

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>Settings</h1>

      {/* Household Switcher */}
      <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>My Households</div>
        {myHouseholds.map(hh => {
          const isActive = hh.id === profile?.active_household_id
          return (
            <div key={hh.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: isActive ? '#2563EB' : '#374151' }}>
                  {isActive && '🏠 '}{hh.name}
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontFamily: 'monospace', letterSpacing: '0.1em' }}>{hh.invite_code}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {isActive ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#2563EB', background: 'rgba(37,99,235,0.1)', borderRadius: 8, padding: '4px 10px' }}>Active</span>
                ) : (
                  <button onClick={() => switchHousehold(hh.id)} disabled={hhLoading} style={{ padding: '7px 14px', borderRadius: 10, border: 'none', background: 'rgba(37,99,235,0.1)', color: '#1D4ED8', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    Switch
                  </button>
                )}
                {/* Leave confirmation */}
                {deleteConfirm === hh.id ? (
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => leaveHousehold(hh.id)} disabled={hhLoading} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.15)', color: '#E11D48', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Leave</button>
                    <button onClick={() => setDeleteConfirm(null)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.06)', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(hh.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.08)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Leave</button>
                )}
                {/* Delete confirmation — owner only */}
                {hh.created_by === user?.id && (
                  deleteHHConfirm === hh.id ? (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => deleteHousehold(hh.id)} disabled={hhLoading} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.20)', color: '#E11D48', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Delete All</button>
                      <button onClick={() => setDeleteHHConfirm(null)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(0,0,0,0.06)', color: '#6B7280', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>Cancel</button>
                    </div>
                  ) : (
                    <button onClick={() => setDeleteHHConfirm(hh.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.08)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>🗑</button>
                  )
                )}
              </div>
            </div>
          )
        })}

        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button onClick={() => { setShowJoinNew(v => !v); setShowCreateNew(false) }} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: '1px solid rgba(37,99,235,0.3)', background: 'transparent', color: '#2563EB', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            + Join Another
          </button>
          <button onClick={() => { setShowCreateNew(v => !v); setShowJoinNew(false) }} style={{ flex: 1, padding: '9px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
            + Create New
          </button>
        </div>

        {showJoinNew && (
          <div style={{ marginTop: 14 }}>
            <input className="glass-input" placeholder="6-digit invite code" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())} style={{ marginBottom: 10, letterSpacing: '0.2em', textAlign: 'center', fontWeight: 800, fontSize: 18 }} maxLength={6} />
            {joinError && <div style={{ color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{joinError}</div>}
            <button onClick={joinNewHousehold} disabled={hhLoading || joinCode.length !== 6} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#10B981,#34D399)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
              {hhLoading ? '…' : 'Join Household'}
            </button>
          </div>
        )}

        {showCreateNew && (
          <div style={{ marginTop: 14 }}>
            <input className="glass-input" placeholder="Household name (e.g. Sunset Ave)" value={newHouseholdName} onChange={e => setNewHouseholdName(e.target.value)} style={{ marginBottom: 10 }} />
            <button onClick={createNewHousehold} disabled={hhLoading || !newHouseholdName.trim()} style={{ width: '100%', padding: '10px 0', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
              {hhLoading ? '…' : 'Create Household'}
            </button>
          </div>
        )}
      </GlassPanel>

      {household && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Invite Code</div>
          <div style={{ fontWeight: 900, fontSize: 32, letterSpacing: '0.2em', color: '#2563EB', fontFamily: 'monospace' }}>{household.invite_code}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Share with roommates to join {household.name}</div>
        </GlassPanel>
      )}

      {/* Profile card */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
                : <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#6366f1' }}>
                    {profile?.username?.slice(0, 1).toUpperCase() ?? '?'}
                  </div>
              }
              <button onClick={handlePhotoButton} disabled={photoUploading} style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, background: '#6366f1', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, color: 'white', fontWeight: 900 }}>
                {photoUploading ? '…' : '✎'}
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChosen} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>@{profile?.username}</div>
              <div style={{ fontSize: 13, color: '#9CA3AF' }}>⭐ {profile?.karma} karma</div>
            </div>
          </div>
          <button onClick={signOut} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>Sign Out</button>
        </div>

        {photoDialog === 'import-or-new' && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>You already have an AppWare profile photo. Use it here?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleImportGlobal} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, Use It</button>
              <button onClick={() => { setPhotoDialog(null); fileRef.current?.click() }} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'transparent', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Choose Different</button>
            </div>
            <button onClick={() => setPhotoDialog(null)} style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        )}

        {photoDialog === 'apply-all' && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Apply this photo to all your AppWare apps?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleApplyAll} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Yes, All Apps</button>
              <button onClick={handleApplyRoomiesOnly} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'transparent', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Just Roomies</button>
            </div>
            <button onClick={() => { setPhotoDialog(null); setPendingFile(null) }} style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          </div>
        )}
      </GlassPanel>

      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>App Tutorial</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>Rewatch the feature walkthrough from the beginning.</div>
        <button onClick={rerunTutorial} style={{ padding: '10px 18px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 14 }}>
          Rerun Tutorial
        </button>
      </GlassPanel>

      {/* Link AppWare */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Link AppWare Account</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 14 }}>
          Connect your AppWare account to sync data across all AppWare apps — Roomies, Hungry, Jukebox, and more.
        </div>
        <a
          href="https://authappware.netlify.app"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '12px 0', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', fontWeight: 700, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none' }}
        >
          🔗 Manage AppWare Account
        </a>
      </GlassPanel>
    </div>
  )
}
