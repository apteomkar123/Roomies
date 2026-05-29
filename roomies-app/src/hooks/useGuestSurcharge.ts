import { useMemo } from 'react'
import { differenceInDays, getDaysInMonth, getMonth, getYear } from 'date-fns'
import type { GuestLog, Transaction, CoLivingAgreement } from '../types'

export interface GuestSurchargeResult {
  hostId: string
  guestName: string
  overstayDays: number
  surchargeAmount: number
}

/**
 * Section 3C – Guest overstay utility surcharge.
 *
 * For each guest log that exceeds the agreement's threshold:
 * 1. overstayDays = totalStay - maxAllowed
 * 2. utilityModifier% = overstayDays / daysInBillingMonth
 * 3. surcharge = utilityModifier * totalUtilitiesForMonth
 */
export function useGuestSurcharge(
  guestLogs: GuestLog[],
  transactions: Transaction[],
  agreement: CoLivingAgreement | null,
  billingMonth: Date = new Date()
): GuestSurchargeResult[] {
  return useMemo(() => {
    if (!agreement) return []

    // Parse max allowed nights from rules text (default 3)
    const maxMatch = agreement.guest_overstay_rules.match(/(\d+)/)
    const maxNights = maxMatch ? parseInt(maxMatch[1]) : 3

    const month = getMonth(billingMonth)
    const year = getYear(billingMonth)
    const daysInMonth = getDaysInMonth(billingMonth)

    // Sum utility expenses for that billing month
    const utilityTotal = transactions
      .filter(tx => {
        const d = new Date(tx.created_at)
        return tx.category === 'Utilities' && getMonth(d) === month && getYear(d) === year
      })
      .reduce((sum, tx) => sum + Number(tx.amount), 0)

    return guestLogs
      .map(log => {
        const stay = differenceInDays(new Date(log.departure_date), new Date(log.arrival_date))
        const overstay = stay - maxNights
        if (overstay <= 0) return null
        const modifier = overstay / daysInMonth
        const surcharge = Math.round(modifier * utilityTotal * 100) / 100
        return { hostId: log.host_id, guestName: log.guest_name, overstayDays: overstay, surchargeAmount: surcharge }
      })
      .filter((r): r is GuestSurchargeResult => r !== null)
  }, [guestLogs, transactions, agreement, billingMonth])
}
