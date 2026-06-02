import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export const TUTORIAL_TOTAL = 11

interface TutorialCtx {
  active: boolean
  step: number
  total: number
  next: () => void
  skip: () => void
}

const Ctx = createContext<TutorialCtx | null>(null)

export function TutorialProvider({ children }: { children: ReactNode }) {
  const { user, profile, refreshProfile } = useAuth()
  const [step, setStep] = useState(0)
  const prevActive = useRef(false)

  const active = !!user && !!profile?.active_household_id && !profile?.has_completed_roomies_tutorial

  // Reset to step 0 whenever tutorial becomes active (e.g. after rerun)
  useEffect(() => {
    if (active && !prevActive.current) setStep(0)
    prevActive.current = active
  }, [active])

  const complete = async () => {
    if (user) {
      await supabase.from('profiles').update({ has_completed_roomies_tutorial: true }).eq('id', user.id)
      await refreshProfile()
    }
  }

  const next = () => {
    if (step >= TUTORIAL_TOTAL - 1) complete()
    else setStep(s => s + 1)
  }

  return (
    <Ctx.Provider value={{ active, step, total: TUTORIAL_TOTAL, next, skip: complete }}>
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTutorial = () => {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useTutorial must be inside TutorialProvider')
  return ctx
}
