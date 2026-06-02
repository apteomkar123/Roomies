import { useMemo } from 'react'
import type { Transaction, TransactionSplit, Transfer, NetBalance } from '../types'

/**
 * Calculates the minimum-transfer set to settle all outstanding debts.
 *
 * Credit = sum of unsettled splits where this person is the PAYER (others owe them).
 * Debit  = sum of unsettled splits where this person is the DEBTOR.
 * Net    = Credit - Debit  (positive = owed money, negative = owes money)
 */
export function useDebtMinimizer(
  transactions: Transaction[],
  splits: TransactionSplit[]
): { netBalances: NetBalance[]; transfers: Transfer[] } {
  return useMemo(() => {
    // Build a lookup from transaction_id → paid_by
    const paidBy: Record<string, string> = {}
    for (const tx of transactions) {
      paidBy[tx.id] = tx.paid_by
    }

    // credit[id] = sum of what others owe this person (unsettled)
    // debit[id]  = sum of what this person owes others (unsettled)
    const credit: Record<string, number> = {}
    const debit: Record<string, number> = {}

    for (const sp of splits) {
      if (sp.settled) continue
      const payerId = paidBy[sp.transaction_id]
      if (!payerId) continue
      credit[payerId] = (credit[payerId] ?? 0) + Number(sp.amount_owed)
      debit[sp.debtor_id] = (debit[sp.debtor_id] ?? 0) + Number(sp.amount_owed)
    }

    const ids = new Set([...Object.keys(credit), ...Object.keys(debit)])
    const nets: Record<string, number> = {}
    for (const id of ids) {
      nets[id] = (credit[id] ?? 0) - (debit[id] ?? 0)
    }

    type Entry = { id: string; amount: number }
    const creditors: Entry[] = []
    const debtors: Entry[] = []

    for (const [id, net] of Object.entries(nets)) {
      if (net > 0.005) creditors.push({ id, amount: net })
      else if (net < -0.005) debtors.push({ id, amount: -net })
    }

    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    const transfers: Transfer[] = []
    let ci = 0, di = 0
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci], d = debtors[di]
      const settle = Math.min(c.amount, d.amount)
      if (settle > 0.005) {
        transfers.push({ from: d.id, to: c.id, amount: Math.round(settle * 100) / 100 })
      }
      c.amount -= settle
      d.amount -= settle
      if (c.amount < 0.005) ci++
      if (d.amount < 0.005) di++
    }

    const netBalances: NetBalance[] = Object.entries(nets)
      .filter(([, n]) => Math.abs(n) > 0.005)
      .map(([id, net]) => ({
        profileId: id,
        username: id,
        net: Math.round(net * 100) / 100,
      }))

    return { netBalances, transfers }
  }, [transactions, splits])
}
