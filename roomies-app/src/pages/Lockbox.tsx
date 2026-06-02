import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useHousehold } from '../context/HouseholdContext'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { LockboxSecret } from '../types'

type KeyType = 'WiFi' | 'Gate Code' | 'Alarm Code' | 'Door Code' | 'Garage Code' | 'General'

const KEY_TYPE_ICONS: Record<KeyType, string> = {
  'WiFi': '📶',
  'Gate Code': '🚧',
  'Alarm Code': '🔔',
  'Door Code': '🚪',
  'Garage Code': '🏠',
  'General': '🔑',
}

function isWifiEntry(key_name: string) {
  return /wi.?fi|wireless|ssid|network|📶/i.test(key_name)
}

function getKeyIcon(key_name: string) {
  if (/wi.?fi|wireless|ssid|network|📶/i.test(key_name)) return '📶'
  if (/gate/i.test(key_name)) return '🚧'
  if (/alarm/i.test(key_name)) return '🔔'
  if (/door/i.test(key_name)) return '🚪'
  if (/garage/i.test(key_name)) return '🏠'
  return '🔑'
}

export default function Lockbox() {
  const { household } = useHousehold()
  const [items, setItems] = useState<LockboxSecret[]>([])
  const [revealed, setRevealed] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)
  const [keyType, setKeyType] = useState<KeyType>('General')
  const [keyName, setKeyName] = useState('')
  const [ssid, setSsid] = useState('')
  const [value, setValue] = useState('')
  const [restricted, setRestricted] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  useEffect(() => {
    if (!household) return
    load()
    const ch = supabase.channel(`lockbox:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lockbox', filter: `household_id=eq.${household.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    if (!household) return
    const { data } = await supabase.from('lockbox').select('*').eq('household_id', household.id)
    setItems((data ?? []) as LockboxSecret[])
  }

  async function addSecret() {
    if (!household) return
    setSaveError(null)
    let finalKeyName = ''
    let finalValue = value.trim()

    if (keyType === 'WiFi') {
      if (!ssid.trim() || !value.trim()) { setSaveError('Enter both SSID and password.'); return }
      finalKeyName = `📶 ${ssid.trim()}`
      finalValue = value.trim()
    } else {
      if (!keyName.trim() || !value.trim()) { setSaveError('Enter key name and value.'); return }
      finalKeyName = `${KEY_TYPE_ICONS[keyType]} ${keyName.trim()}`
      finalValue = value.trim()
    }

    const { error } = await supabase.from('lockbox').insert({ household_id: household.id, key_name: finalKeyName, value: finalValue, is_restricted: restricted })
    if (error) { setSaveError(error.message); return }
    setKeyName(''); setSsid(''); setValue(''); setRestricted(false); setShowAdd(false); load()
  }

  async function deleteSecret(id: string) {
    await supabase.from('lockbox').delete().eq('id', id)
    load()
  }

  const toggle = (id: string) => setRevealed(prev => {
    const n = new Set(prev)
    if (n.has(id)) n.delete(id); else n.add(id)
    return n
  })

  async function copyValue(val: string, id: string) {
    try {
      await navigator.clipboard.writeText(val)
      setCopied(id)
      setTimeout(() => setCopied(null), 2500)
    } catch { /* clipboard not available */ }
  }

  function openWifiSettings() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
    if (isIOS) {
      window.location.href = 'App-Prefs:WIFI'
    } else {
      window.location.href = 'intent://settings/wifi#Intent;scheme=android-app;package=com.android.settings;end'
    }
  }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Lockbox</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Shared household secrets</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}

          {/* Key type selector */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', marginBottom: 8 }}>KEY TYPE</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(['WiFi', 'Gate Code', 'Alarm Code', 'Door Code', 'Garage Code', 'General'] as KeyType[]).map(t => (
                <button
                  key={t}
                  onClick={() => setKeyType(t)}
                  style={{ padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, background: keyType === t ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: keyType === t ? '#fff' : '#374151', transition: 'all 0.15s' }}
                >
                  {KEY_TYPE_ICONS[t]} {t}
                </button>
              ))}
            </div>
          </div>

          {keyType === 'WiFi' ? (
            <>
              <input className="glass-input" placeholder="Network name (SSID)" value={ssid} onChange={e => setSsid(e.target.value)} style={{ marginBottom: 12 }} />
              <input className="glass-input" placeholder="Password" value={value} onChange={e => setValue(e.target.value)} style={{ marginBottom: 12 }} type="text" />
            </>
          ) : (
            <>
              <input className="glass-input" placeholder={`${keyType} name / label`} value={keyName} onChange={e => setKeyName(e.target.value)} style={{ marginBottom: 12 }} />
              <input className="glass-input" placeholder="Value / code" value={value} onChange={e => setValue(e.target.value)} style={{ marginBottom: 12 }} />
            </>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={restricted} onChange={e => setRestricted(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#2563EB' }} />
            Restrict (hide by default, require tap to reveal)
          </label>
          <button className="btn-blue" onClick={addSecret}>Save to Lockbox</button>
        </GlassPanel>
      )}

      {items.map(item => {
        const hidden = item.is_restricted && !revealed.has(item.id)
        const isWifi = isWifiEntry(item.key_name)
        const icon = getKeyIcon(item.key_name)
        return (
          <GlassPanel key={item.id} style={{ padding: 20, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{item.key_name.replace(/^[^\w]+\s/, '')}</div>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: 15, color: hidden ? '#D1D5DB' : '#111827', wordBreak: 'break-all' }}>
                  {hidden ? '•'.repeat(16) : item.value}
                </div>
                {/* WiFi connect controls */}
                {isWifi && !hidden && (
                  <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      onClick={() => copyValue(item.value, item.id)}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: 'none', background: copied === item.id ? 'rgba(16,185,129,0.15)' : 'rgba(37,99,235,0.1)', color: copied === item.id ? '#059669' : '#1D4ED8', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                    >
                      {copied === item.id ? '✓ Copied!' : '📋 Copy Password'}
                    </button>
                    <button
                      onClick={() => { copyValue(item.value, item.id); openWifiSettings() }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid rgba(37,99,235,0.25)', background: 'transparent', color: '#2563EB', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}
                    >
                      📡 Connect
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8, marginLeft: 12 }}>
                {item.is_restricted && (
                  <button onClick={() => toggle(item.id)} style={{ padding: '8px 14px', borderRadius: 10, border: 'none', background: 'rgba(37,99,235,0.1)', color: '#1D4ED8', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    {hidden ? '👁 Reveal' : '🙈 Hide'}
                  </button>
                )}
                {!item.is_restricted && !isWifi && (
                  <button onClick={() => copyValue(item.value, item.id)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: copied === item.id ? 'rgba(16,185,129,0.1)' : 'rgba(37,99,235,0.08)', color: copied === item.id ? '#059669' : '#1D4ED8', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                    {copied === item.id ? '✓' : '📋'}
                  </button>
                )}
                <button onClick={() => deleteSecret(item.id)} style={{ padding: '8px 12px', borderRadius: 10, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 13 }}>
                  ✕
                </button>
              </div>
            </div>
          </GlassPanel>
        )
      })}

      {items.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#9CA3AF' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔐</div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>Lockbox is empty</div>
          <div style={{ fontSize: 14 }}>Add Wi-Fi passwords, alarm codes, and more</div>
        </div>
      )}
    </div>
  )
}
