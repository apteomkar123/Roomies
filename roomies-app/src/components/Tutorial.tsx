import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const STEPS = [
  {
    icon: '🏠',
    title: 'Welcome to Roomies!',
    isIntro: true,
    quote: "Everyone skips tutorials, but you won't want to skip this one. You can do a lot with this app.",
    features: [] as { icon: string; name: string; desc: string }[],
  },
  {
    icon: '🟢',
    title: 'Dashboard & Presence',
    isIntro: false,
    quote: '',
    features: [
      { icon: '🔮', name: 'Avatar Halo', desc: 'The glow color shows roommate status — Mint = Available, Purple = WFH, Blue = Sleeping, Coral = Away.' },
      { icon: '🟢', name: 'Presence Selector', desc: 'Toggle your status. Setting "Away" automatically pauses your chore rotation.' },
      { icon: '📢', name: 'Buzz Deck', desc: 'One-tap Trash or Quiet alerts — sends an instant notice to every roommate.' },
    ],
  },
  {
    icon: '⚙️',
    title: 'Shared Logistics',
    isIntro: false,
    quote: '',
    features: [
      { icon: '🕐', name: 'Appliance Booker', desc: 'Hourly grid for shared resources like the washing machine. Claim your slot to avoid conflicts.' },
      { icon: '🐾', name: 'Pet Tracker', desc: 'Log feeds, walks, and meds. Every action is timestamped with your name.' },
      { icon: '🔐', name: 'Lockbox', desc: 'Store Wi-Fi codes, gate sequences, and other secrets. Masked by default — tap to reveal.' },
    ],
  },
  {
    icon: '✨',
    title: 'Chores & Karma',
    isIntro: false,
    quote: '',
    features: [
      { icon: '🔄', name: 'Modulo Rotation', desc: 'Chores rotate fairly via a mathematical formula — no one gets stuck with the same task forever.' },
      { icon: '🛒', name: 'Karma Marketplace', desc: "Auction a chore you can't do for Karma or cash. Claim others' auctions to earn bounties." },
      { icon: '⭐', name: 'Karma System', desc: 'Earn +10 Karma for every completed chore. Your score lives on your profile.' },
    ],
  },
  {
    icon: '💰',
    title: 'Finance',
    isIntro: false,
    quote: '',
    features: [
      { icon: '🧮', name: 'Debt Minimizer', desc: 'Greedy Matching algorithm calculates the minimum transfers needed to settle all house debts.' },
      { icon: '✅', name: 'One-Tap Settlement', desc: 'Mark your debts as paid instantly — no more awkward reminders.' },
    ],
  },
  {
    icon: '🏡',
    title: 'Guests & Maintenance',
    isIntro: false,
    quote: '',
    features: [
      { icon: '👥', name: 'Guest Logs', desc: 'Log visitor stays with arrival and departure dates.' },
      { icon: '💸', name: 'Overstay Surcharge', desc: 'Guests past the agreed limit automatically trigger a utility surcharge calculation.' },
      { icon: '🔧', name: 'Maintenance Tickets', desc: 'Report broken items with a photo. Stored in the Property Vault.' },
    ],
  },
  {
    icon: '💬',
    title: 'Communication & Shopping',
    isIntro: false,
    quote: '',
    features: [
      { icon: '📋', name: 'Notices', desc: 'Post Memos, Landlord Notices, or Buzz Alerts. Read receipts show who has seen each one.' },
      { icon: '🛍️', name: 'Shopping List', desc: 'Add items with quantity. Flag urgent purchases so they stand out.' },
    ],
  },
  {
    icon: '🧭',
    title: 'Navigation',
    isIntro: false,
    quote: '',
    features: [
      { icon: '💫', name: 'Floating Capsule Nav', desc: 'The bottom bar gives instant access to every feature — Dashboard, Chores, Finance, and more.' },
    ],
  },
]

export default function Tutorial() {
  const { user, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)

  const complete = async () => {
    if (user) {
      await supabase.from('profiles').update({ has_completed_roomies_tutorial: true }).eq('id', user.id)
      await refreshProfile()
    }
  }

  const current = STEPS[step]
  const isLast = step === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(6px)',
      WebkitBackdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'rgba(255,255,255,0.88)',
        backdropFilter: 'blur(24px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
        border: '1px solid rgba(255,255,255,0.65)',
        borderRadius: 28,
        boxShadow: '0 24px 64px rgba(0,0,0,0.22), inset 0 1px 0 rgba(255,255,255,0.8)',
        padding: '32px 28px',
        maxHeight: '88vh',
        overflowY: 'auto',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === step ? 22 : 6, height: 6, borderRadius: 999,
              background: i === step
                ? 'linear-gradient(90deg,#6366f1,#8b5cf6)'
                : i < step ? '#a5b4fc' : 'rgba(0,0,0,0.1)',
              transition: 'all 0.3s',
            }} />
          ))}
        </div>

        {/* Icon + title */}
        <div style={{ textAlign: 'center', marginBottom: current.isIntro ? 0 : 24 }}>
          <div style={{ fontSize: 56, marginBottom: 12, lineHeight: 1 }}>{current.icon}</div>
          <h2 style={{ fontWeight: 900, fontSize: 24, margin: 0, letterSpacing: '-0.5px' }}>{current.title}</h2>
        </div>

        {/* Intro quote */}
        {current.isIntro && (
          <div style={{
            margin: '20px 0 28px',
            padding: '18px 20px',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.07), rgba(139,92,246,0.07))',
            borderLeft: '3px solid #6366f1',
            borderRadius: '0 14px 14px 0',
          }}>
            <p style={{ margin: 0, color: '#374151', fontSize: 15, fontStyle: 'italic', lineHeight: 1.65 }}>
              "{current.quote}"
            </p>
          </div>
        )}

        {/* Feature cards */}
        {current.features.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
            {current.features.map(f => (
              <div key={f.name} style={{
                display: 'flex', gap: 14, alignItems: 'flex-start',
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(255,255,255,0.55)',
                borderRadius: 16, padding: '14px 16px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              }}>
                <span style={{ fontSize: 26, flexShrink: 0, lineHeight: 1 }}>{f.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>{f.name}</div>
                  <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.55 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {!isLast ? (
            <>
              <button
                onClick={complete}
                style={{ flex: 1, padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.6)', background: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#9CA3AF', fontFamily: 'inherit' }}
              >
                Skip
              </button>
              <button
                onClick={() => setStep(s => s + 1)}
                style={{ flex: 2, padding: '12px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#fff', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(99,102,241,0.35)' }}
              >
                Next →
              </button>
            </>
          ) : (
            <button
              onClick={complete}
              style={{ flex: 1, padding: '14px 16px', borderRadius: 12, border: 'none', background: 'linear-gradient(135deg, #10B981, #34D399)', cursor: 'pointer', fontWeight: 700, fontSize: 15, color: '#fff', fontFamily: 'inherit', boxShadow: '0 4px 16px rgba(16,185,129,0.35)' }}
            >
              Let's go! 🚀
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
