import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { supabase } from '../lib/supabase'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import NavBar from '../components/ui/NavBar'

type PhotoDialog = 'import-or-new' | 'apply-all' | null

export default function More() {
  const { profile, user, signOut, refreshProfile, updateAvatar } = useAuth()
  const { household } = useHousehold()
  const navigate = useNavigate()

  const [photoDialog, setPhotoDialog] = useState<PhotoDialog>(null)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [photoUploading, setPhotoUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  async function rerunTutorial() {
    if (!user) return
    await supabase.from('profiles').update({ has_completed_roomies_tutorial: false }).eq('id', user.id)
    await refreshProfile()
  }

  function handlePhotoButton() {
    if (profile?.avatar_url) {
      setPhotoDialog('import-or-new')
    } else {
      fileRef.current?.click()
    }
  }

  async function handleFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    if (!profile?.avatar_url) {
      setPendingFile(file)
      setPhotoDialog('apply-all')
    } else {
      // Chose a new Roomies-specific photo (declined import)
      setPhotoUploading(true)
      await updateAvatar(file, 'roomies')
      setPhotoUploading(false)
      setPhotoDialog(null)
    }
  }

  async function handleImportGlobal() {
    // Clear Roomies-specific override so global shows
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

  const PAGES = [
    { icon: '🛒', label: 'Shopping List',    path: '/shopping' },
    { icon: '🐾', label: 'Pet Care',          path: '/pets'     },
    { icon: '👥', label: 'Guest Log',         path: '/guests'   },
    { icon: '🔒', label: 'Lockbox',           path: '/lockbox'  },
    { icon: '📊', label: 'Karma Leaderboard', path: '/karma'    },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 120px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <NavBar />

      <h1 style={{ fontWeight: 900, fontSize: 28, margin: '0 0 24px', letterSpacing: '-0.5px' }}>More</h1>

      {household && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>Invite Code</div>
          <div style={{ fontWeight: 900, fontSize: 32, letterSpacing: '0.2em', color: '#2563EB', fontFamily: 'monospace' }}>{household.invite_code}</div>
          <div style={{ fontSize: 13, color: '#9CA3AF', marginTop: 4 }}>Share with roommates to join {household.name}</div>
        </GlassPanel>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        {PAGES.map(p => (
          <GlassPanel key={p.path} onClick={() => navigate(p.path)} style={{ padding: 20, cursor: 'pointer', transition: 'transform 0.15s' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{p.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{p.label}</div>
          </GlassPanel>
        ))}
      </div>

      {/* Profile card with smart photo upload */}
      <GlassPanel style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {/* Avatar with single edit button */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              {photo
                ? <img src={photo} alt="" style={{ width: 52, height: 52, borderRadius: 14, objectFit: 'cover', border: '1px solid rgba(255,255,255,0.2)' }} />
                : <div style={{ width: 52, height: 52, borderRadius: 14, background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 900, color: '#6366f1' }}>
                    {profile?.username?.slice(0, 1).toUpperCase() ?? '?'}
                  </div>
              }
              <button
                onClick={handlePhotoButton}
                disabled={photoUploading}
                style={{ position: 'absolute', bottom: -4, right: -4, width: 20, height: 20, borderRadius: 10, background: '#6366f1', border: '2px solid white', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 11, color: 'white', fontWeight: 900 }}
              >
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

        {/* Smart photo dialog */}
        {photoDialog === 'import-or-new' && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>You already have an AppWare profile photo. Use it here?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleImportGlobal} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Yes, Use It
              </button>
              <button onClick={() => { setPhotoDialog(null); fileRef.current?.click() }} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'transparent', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Choose Different
              </button>
            </div>
            <button onClick={() => setPhotoDialog(null)} style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
          </div>
        )}

        {photoDialog === 'apply-all' && (
          <div style={{ marginTop: 14, padding: 14, background: 'rgba(99,102,241,0.06)', borderRadius: 12, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10 }}>Apply this photo to all your AppWare apps?</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={handleApplyAll} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: 'none', background: '#6366f1', color: '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Yes, All Apps
              </button>
              <button onClick={handleApplyRoomiesOnly} style={{ flex: 1, padding: '8px 0', borderRadius: 10, border: '1px solid rgba(99,102,241,0.3)', background: 'transparent', color: '#6366f1', fontWeight: 700, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Just Roomies
              </button>
            </div>
            <button onClick={() => { setPhotoDialog(null); setPendingFile(null) }} style={{ marginTop: 8, width: '100%', background: 'none', border: 'none', color: '#9CA3AF', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit' }}>
              Cancel
            </button>
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
    </div>
  )
}
