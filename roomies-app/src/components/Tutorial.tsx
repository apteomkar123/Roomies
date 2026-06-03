import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTutorial } from '../context/TutorialContext'

interface Step {
  route: string
  elementId: string
  title: string
  desc: string
  side: 'top' | 'bottom'
}

const STEPS: Step[] = [
  { route: '/', elementId: 'tut-presence', title: 'Your Presence', side: 'bottom',
    desc: 'Tap a status to broadcast it to your roommates. Setting "Away" automatically pauses your chore rotation.' },
  { route: '/', elementId: 'tut-buzz', title: 'Buzz Deck', side: 'top',
    desc: 'One tap fires a Trash or Quiet Hours alert to everyone in the house instantly.' },
  { route: '/bookings', elementId: 'tut-appliance', title: 'Utility Booker', side: 'bottom',
    desc: 'Claim hourly slots for shared utilities. The colour-coded grid shows exactly who\'s booked what. Tap your own slot to cancel it.' },
  { route: '/pets', elementId: 'tut-pets', title: 'Pet Tracker', side: 'bottom',
    desc: 'Log feeds, walks, and meds for your household pets. Add pet-specific custom chores from this page.' },
  { route: '/', elementId: 'tut-lockbox', title: 'Property Lockbox', side: 'top',
    desc: 'Wi-Fi codes, gate sequences, spare key combos. Tap the panel to open the full Lockbox, or tap Reveal — Wi-Fi secrets show a Copy & Connect button.' },
  { route: '/', elementId: 'tut-nav-open', title: 'Navigation', side: 'bottom',
    desc: 'Tap the Roomies logo (top-left) or swipe right anywhere on screen to open the menu. All features — Chores, Bills, Notices, Shopping, Pets, Guests, Lockbox, Karma, Inventory, and Settings.' },
  { route: '/chores', elementId: 'tut-rotation', title: 'Intensity-Balanced Chores', side: 'bottom',
    desc: 'Chores are assigned by workload intensity — vacuuming and bathrooms weigh heavier than trash or dishes, so no one carries more than their share. Tap an assignee\'s avatar to reassign any chore. Complete one to earn +10 Karma.' },
  { route: '/chores', elementId: 'tut-marketplace', title: 'Karma Marketplace', side: 'top',
    desc: 'Too busy? Auction a chore for Karma. Claim others\' auctions and earn the bounty. The marketplace appears once a chore is auctioned.' },
  { route: '/finance', elementId: 'tut-finance', title: 'Bills & Debt Minimizer', side: 'bottom',
    desc: 'Track shared bills and split them easily. Greedy Matching calculates the fewest transfers to settle all house debts. Tap Venmo to pay directly.' },
  { route: '/shopping', elementId: 'tut-shopping', title: 'Shared Grocery List with Hungry', side: 'bottom',
    desc: 'Items added in Hungry appear here automatically. Add items here and they show in Hungry too. Check off from either app.' },
  { route: '/chores', elementId: 'tut-rotation', title: 'Chore Sync Anthems', side: 'top',
    desc: 'When you mark a chore done, Jukebox queues a BPM-matched playlist — easy chores get chill beats, hard tasks get high-energy music.' },
  { route: '/inventory', elementId: 'tut-inventory', title: 'Household Inventory', side: 'bottom',
    desc: 'Track your pantry (synced from Hungry) and household supplies like paper towels, cleaning products, and more. Never run out.' },
]

const TOOLTIP_W = 290

export default function Tutorial() {
  const { active, step, total, next, skip } = useTutorial()
  const navigate = useNavigate()
  const [rect, setRect] = useState<DOMRect | null>(null)

  const current = STEPS[step]

  // Navigate to correct page for this step
  useEffect(() => {
    if (!active) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRect(null)
    navigate(current.route)
  }, [step, active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Find element and measure it; fall back to a centre rect if element is in a conditional render
  useEffect(() => {
    if (!active) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRect(null)
    const find = () => {
      const el = document.getElementById(current.elementId)
      if (el) { setRect(el.getBoundingClientRect()); return true }
      return false
    }
    if (!find()) {
      const t = setTimeout(() => {
        if (!find()) {
          // Element is conditionally rendered (e.g. empty chores/finance) — use a centre fallback
          setRect(new DOMRect(
            window.innerWidth * 0.1,
            window.innerHeight * 0.38,
            window.innerWidth * 0.8,
            56
          ))
        }
      }, 400)
      return () => clearTimeout(t)
    }
  }, [step, active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-measure on resize
  useEffect(() => {
    if (!active || !rect) return
    const update = () => {
      const el = document.getElementById(current.elementId)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [step, active, rect]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!active) return null

  const pad = 10

  // Spotlight style — box-shadow creates the dark vignette outside the element
  const spotStyle: CSSProperties = rect ? {
    position: 'fixed',
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
    borderRadius: 18,
    pointerEvents: 'none',
    boxShadow: '0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 2.5px rgba(139,92,246,0.9)',
    zIndex: 1001,
    animation: 'tutGlow 2s ease-in-out infinite',
  } : {}

  // Tooltip position
  const TOOLTIP_H = 210
  let tipTop = 0
  let tipLeft = 0
  if (rect) {
    const gap = 18
    if (current.side === 'bottom') {
      tipTop = rect.bottom + pad + gap
      // If it would go off the bottom, flip above
      if (tipTop + TOOLTIP_H > window.innerHeight - 12) {
        tipTop = rect.top - pad - gap - TOOLTIP_H
      }
    } else {
      tipTop = rect.top - pad - gap - TOOLTIP_H
      // If it would go off the top, flip below
      if (tipTop < 12) {
        tipTop = rect.bottom + pad + gap
      }
    }
    // Hard-clamp within viewport
    tipTop = Math.max(12, Math.min(tipTop, window.innerHeight - TOOLTIP_H - 12))
    tipLeft = Math.max(12, Math.min(
      rect.left + rect.width / 2 - TOOLTIP_W / 2,
      window.innerWidth - TOOLTIP_W - 12
    ))
  }

  return (
    <>
      <style>{`
        @keyframes tutGlow {
          0%,100% { box-shadow: 0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 2.5px rgba(139,92,246,0.9); }
          50%      { box-shadow: 0 0 0 9999px rgba(0,0,0,0.68), 0 0 0 4px rgba(99,102,241,1), 0 0 24px rgba(139,92,246,0.5); }
        }
        @keyframes tutIn {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)  scale(1); }
        }
      `}</style>

      {/* Click-to-advance backdrop */}
      <div onClick={next} style={{ position: 'fixed', inset: 0, zIndex: 1000, cursor: 'pointer' }} />

      {/* Spotlight ring around target */}
      {rect && <div style={spotStyle} />}

      {/* Tooltip card */}
      {rect && (
        <div style={{
          position: 'fixed', top: tipTop, left: tipLeft, width: TOOLTIP_W,
          zIndex: 1002, pointerEvents: 'none',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.7)',
          borderRadius: 22,
          padding: '18px 20px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.22), 0 0 0 1.5px rgba(99,102,241,0.18)',
          animation: 'tutIn 0.28s cubic-bezier(0.34,1.56,0.64,1)',
        }}>
          {/* Progress bar */}
          <div style={{ display: 'flex', gap: 4, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                flex: 1, height: 3, borderRadius: 999,
                background: i < step ? '#a5b4fc' : i === step ? 'linear-gradient(90deg,#6366f1,#8b5cf6)' : 'rgba(0,0,0,0.08)',
                transition: 'background 0.3s',
              }} />
            ))}
          </div>

          <div style={{ fontWeight: 800, fontSize: 15, color: '#111827', marginBottom: 6 }}>{current.title}</div>
          <div style={{ fontSize: 13, color: '#4B5563', lineHeight: 1.6 }}>{current.desc}</div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, pointerEvents: 'all' }}>
            <button onClick={(e) => { e.stopPropagation(); skip() }}
              style={{ background: 'none', border: 'none', color: '#9CA3AF', fontWeight: 600, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
              Skip tour
            </button>
            <button onClick={(e) => { e.stopPropagation(); next() }}
              style={{ padding: '8px 18px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(99,102,241,0.4)' }}>
              {step === total - 1 ? "Let's go! 🚀" : 'Next →'}
            </button>
          </div>
          <div style={{ textAlign: 'center', fontSize: 11, color: '#D1D5DB', marginTop: 8 }}>
            tap anywhere to continue · {step + 1} of {total}
          </div>
        </div>
      )}

      {/* Loading state while finding element */}
      {!rect && (
        <div style={{ position: 'fixed', bottom: 40, left: '50%', transform: 'translateX(-50%)', zIndex: 1002, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(20px)', borderRadius: 999, padding: '12px 24px', fontWeight: 700, fontSize: 14, color: '#6366f1', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}>
          Loading tutorial…
        </div>
      )}
    </>
  )
}
