import { useMemo } from 'react'
import { differenceInDays } from 'date-fns'
import type { Chore, Profile } from '../types'

const RECURRENCE_DAYS: Record<string, number> = {
  'Twice Weekly': 3,
  'Weekly': 7,
  'Bi-Weekly': 14,
  'Monthly': 30,
  'Quarterly': 91,
}

/**
 * Returns the assigned profile for a chore on a given target date.
 * Only considers roommates with away=false (unpaused).
 *
 * index = (rotation_offset + floor(daysSinceCreation / periodDays)) % activeRoommateCount
 */
export function useChoreRotation(
  chore: Chore,
  activeMembers: Profile[],
  targetDate: Date = new Date()
): Profile | null {
  return useMemo(() => {
    const available = activeMembers.filter(m => !m.away)
    if (!available.length) return null

    const periodDays = RECURRENCE_DAYS[chore.recurrence] ?? 7
    const created = new Date(chore.created_at)
    const elapsed = Math.floor(differenceInDays(targetDate, created) / periodDays)
    const idx = (chore.rotation_offset + elapsed) % available.length
    return available[(idx + available.length) % available.length]
  }, [chore, activeMembers, targetDate])
}

/**
 * Pure util version (no hook) for use outside React render.
 */
export function calcChoreAssignee(
  chore: Chore,
  activeMembers: Profile[],
  targetDate: Date = new Date()
): Profile | null {
  const available = activeMembers.filter(m => !m.away)
  if (!available.length) return null
  const periodDays = RECURRENCE_DAYS[chore.recurrence] ?? 7
  const created = new Date(chore.created_at)
  const elapsed = Math.floor(differenceInDays(targetDate, created) / periodDays)
  const idx = (chore.rotation_offset + elapsed) % available.length
  return available[(idx + available.length) % available.length]
}
