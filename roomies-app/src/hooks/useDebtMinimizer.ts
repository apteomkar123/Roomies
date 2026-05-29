import { useMemo } from 'react'
import type { Transaction, TransactionSplit, Transfer, NetBalance } from '../types'

/**
 * Calculates the minimum-transfer set to settle all outstanding debts.
 *
 * Algorithm (Section 3B):
 * 1. Net per user = Σ(amount paid) - Σ(splits owed)
 * 2. Split into creditors (net > 0) and debtors (net < 0)
 * 3. Greedily match largest debtor → largest creditor until all settled
 */
export function useDebtMinimizer(
  transactions: Transaction[],
  splits: TransactionSplit[]
): { netBalances: NetBalance[]; transfers: Transfer[] } {
  return useMemo(() => {
    const paid: Record<string, number> = {}
    const owed: Record<string, number> = {}

    for (const tx of transactions) {
      paid[tx.paid_by] = (paid[tx.paid_by] ?? 0) + Number(tx.amount)
    }

    for (const sp of splits) {
      if (!sp.settled) {
        owed[sp.debtor_id] = (owed[sp.debtor_id] ?? 0) + Number(sp.amount_owed)
      }
    }

    const ids = new Set([...Object.keys(paid), ...Object.keys(owed)])
    const nets: Record<string, number> = {}
    for (const id of ids) {
      nets[id] = (paid[id] ?? 0) - (owed[id] ?? 0)
    }

    // Build creditor/debtor lists
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

    let ci = 0
    let di = 0
    while (ci < creditors.length && di < debtors.length) {
      const c = creditors[ci]
      const d = debtors[di]
      const settle = Math.min(c.amount, d.amount)
      if (settle > 0.005) {
        transfers.push({ from: d.id, to: c.id, amount: Math.round(settle * 100) / 100 })
      }
      c.amount -= settle
      d.amount -= settle
      if (c.amount < 0.005) ci++
      if (d.amount < 0.005) di++
    }

    // Build net balance display list (all users with non-zero net)
    const netBalances: NetBalance[] = Object.entries(nets)
      .filter(([, n]) => Math.abs(n) > 0.005)
      .map(([id, net]) => ({
        profileId: id,
        username: id, // caller resolves to username via profiles lookup
        net: Math.round(net * 100) / 100,
      }))

    return { netBalances, transfers }
  }, [transactions, splits])
}
