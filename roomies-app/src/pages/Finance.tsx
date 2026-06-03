import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useDebtMinimizer } from '../hooks/useDebtMinimizer'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { Transaction, TransactionSplit } from '../types'
import { format } from 'date-fns'

type Category = 'Rent' | 'Groceries' | 'Utilities' | 'Shared Subscriptions' | 'Miscellaneous Ad-Hoc'

export default function Finance() {
  const { user, profile } = useAuth()
  const { household, memberProfiles } = useHousehold()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [splits, setSplits] = useState<TransactionSplit[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState<Category>('Miscellaneous Ad-Hoc')
  const [splitEveryone, setSplitEveryone] = useState(true)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [settleError, setSettleError] = useState<string | null>(null)
  const [settleSuccess, setSettleSuccess] = useState(false)

  const profileMap = Object.fromEntries(memberProfiles.map(p => [p.id, p.username]))
  const venmoMap = Object.fromEntries(memberProfiles.map(p => [p.id, p.venmo_username ?? null]))
  const { transfers, netBalances } = useDebtMinimizer(transactions, splits)
  const namedTransfers = transfers.map(t => ({
    ...t,
    fromName: profileMap[t.from] ?? t.from,
    toName: profileMap[t.to] ?? t.to,
    toVenmo: venmoMap[t.to] ?? null,
  }))
  const namedBalances = netBalances.map(b => ({ ...b, username: profileMap[b.profileId] ?? b.profileId }))

  // Current user's debts (they owe someone) vs. credits (someone owes them)
  const myDebtSplits = splits.filter(s => s.debtor_id === user?.id)
  const myVenmo = profile?.venmo_username ?? null

  useEffect(() => {
    if (!household) return
    loadAll()
    const ch = supabase.channel(`finance:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_splits' }, loadAll)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [household]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadAll() {
    if (!household) return
    const [{ data: txs }, { data: sp }] = await Promise.all([
      supabase.from('transactions').select('*, profiles(username)').eq('household_id', household.id).order('created_at', { ascending: false }),
      supabase.from('transaction_splits').select('*').eq('settled', false),
    ])
    const txList = (txs ?? []) as Transaction[]
    setTransactions(txList)
    const txIds = new Set(txList.map(t => t.id))
    setSplits(((sp ?? []) as TransactionSplit[]).filter(s => txIds.has(s.transaction_id)))
  }

  async function addTransaction() {
    if (!amount || !household) return
    setSaveError(null)
    const { data: tx, error } = await supabase
      .from('transactions')
      .insert({ household_id: household.id, paid_by: user!.id, amount: parseFloat(amount), memo, category })
      .select().single()
    if (error) { setSaveError(error.message); return }
    if (tx && splitEveryone) {
      const others = memberProfiles.filter(p => p.id !== user!.id)
      const share = parseFloat(amount) / memberProfiles.length
      await supabase.from('transaction_splits').insert(others.map(p => ({ transaction_id: tx.id, debtor_id: p.id, amount_owed: Math.round(share * 100) / 100 })))
    }
    setAmount(''); setMemo(''); setShowAdd(false); loadAll()
  }

  async function deleteTransaction(id: string) {
    await supabase.from('transaction_splits').delete().eq('transaction_id', id)
    await supabase.from('transactions').delete().eq('id', id)
    loadAll()
  }

  async function settleAll() {
    if (!household || settling) return
    setSettling(true)
    setSettleError(null)
    setSettleSuccess(false)

    const mySplitIds = myDebtSplits.map(s => s.id)
    if (mySplitIds.length) {
      const { error } = await supabase.from('transaction_splits').update({ settled: true }).in('id', mySplitIds)
      if (error) {
        setSettleError(error.message)
        setSettling(false)
        return
      }
    }

    const { data: remaining } = await supabase
      .from('transaction_splits')
      .select('id')
      .eq('settled', false)
      .in('transaction_id', transactions.map(t => t.id))
      .limit(1)
    if (!remaining?.length) {
      supabase.from('cross_app_activity').insert({
        user_id: user!.id,
        app: 'homebase',
        activity_type: 'all_bills_paid',
        is_public: true,
        payload: { household_id: household.id, message: 'All bills are paid! 🎉 Financial Freedom unlocked.' },
      }).then(() => {})
    }

    setSettleSuccess(true)
    setTimeout(() => setSettleSuccess(false), 3000)
    setSettling(false)
    loadAll()
  }

  const CATEGORY_COLORS: Record<string, string> = { 'Rent': '#2563EB', 'Groceries': '#10B981', 'Utilities': '#F59E0B', 'Shared Subscriptions': '#8B5CF6', 'Miscellaneous Ad-Hoc': '#6B7280' }

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Bills</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Split bills</div>
        </div>
        <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Add
        </button>
      </div>

      {showAdd && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
          <input className="glass-input" type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: 12 }} />
          <input className="glass-input" placeholder="Memo (e.g. Groceries run)" value={memo} onChange={e => setMemo(e.target.value)} style={{ marginBottom: 12 }} />
          <select value={category} onChange={e => setCategory(e.target.value as Category)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}>
            {['Rent','Groceries','Utilities','Shared Subscriptions','Miscellaneous Ad-Hoc'].map(c => <option key={c}>{c}</option>)}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
            <input type="checkbox" checked={splitEveryone} onChange={e => setSplitEveryone(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#2563EB' }} />
            Split equally among all roommates
          </label>
          <button className="btn-blue" onClick={addTransaction}>Add Transaction</button>
        </GlassPanel>
      )}

      {namedTransfers.length > 0 && (
        <GlassPanel id="tut-finance" style={{ padding: 20, marginBottom: 20, border: '1.5px solid rgba(37,99,235,0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Settle Up</div>
            {myDebtSplits.length > 0 ? (
              <button
                onClick={settleAll}
                disabled={settling}
                style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: settleSuccess ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.12)', color: settleSuccess ? '#059669' : '#059669', fontWeight: 700, cursor: settling ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: settling ? 0.7 : 1 }}
              >
                {settling ? '…' : settleSuccess ? '✓ Marked Paid!' : 'Mark My Debts Paid'}
              </button>
            ) : (
              <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '4px 10px' }}>
                ✓ You're all paid up!
              </span>
            )}
          </div>

          {settleError && (
            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '8px 12px', color: '#E11D48', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>
              {settleError}
            </div>
          )}

          {/* Venmo share card for current user when they're owed money */}
          {namedTransfers.some(t => t.to === user?.id) && (
            <div style={{ background: 'rgba(0,140,255,0.06)', border: '1px solid rgba(0,140,255,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#008CFF', marginBottom: 4 }}>💸 You're owed money</div>
              {myVenmo ? (
                <div style={{ fontSize: 12, color: '#374151' }}>
                  Share your Venmo <strong>@{myVenmo}</strong> with your roommates so they can pay you.
                </div>
              ) : (
                <div style={{ fontSize: 12, color: '#6B7280' }}>
                  Add your Venmo username in <strong>Settings</strong> so roommates can pay you directly.
                </div>
              )}
            </div>
          )}

          {namedTransfers.map((t, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{t.fromName}</span>
                <span style={{ color: '#6B7280', fontSize: 13 }}>owes</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: '#2563EB' }}>${t.amount.toFixed(2)}</span>
                <span style={{ color: '#6B7280', fontSize: 13 }}>to</span>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{t.toName}</span>
              </div>
              {t.from === user?.id && (
                t.toVenmo ? (
                  <a
                    href={`https://venmo.com/${t.toVenmo}?txn=pay&amount=${t.amount.toFixed(2)}&note=HomeBase%20Bill`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(0,140,255,0.1)', color: '#008CFF', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}
                  >
                    💸 Pay via Venmo
                  </a>
                ) : (
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>
                    Ask {t.toName} to add their Venmo in Settings to pay directly.
                  </div>
                )
              )}
            </div>
          ))}
        </GlassPanel>
      )}

      {namedBalances.length > 0 && (
        <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Net Balances</div>
          {namedBalances.map(b => (
            <div key={b.profileId} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
              <span style={{ fontWeight: 700 }}>{b.username}</span>
              <span style={{ fontWeight: 800, color: b.net >= 0 ? '#10B981' : '#F43F5E' }}>{b.net >= 0 ? '+' : ''}${b.net.toFixed(2)}</span>
            </div>
          ))}
        </GlassPanel>
      )}

      <GlassPanel style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Transactions</div>
        {transactions.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 14 }}>No transactions yet.</div>}
        {transactions.map(tx => (
          <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[tx.category] ?? '#6B7280', display: 'inline-block' }} />
                <span style={{ fontWeight: 700, fontSize: 15 }}>{tx.memo || tx.category}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>Paid by {tx.profiles?.username} · {format(new Date(tx.created_at), 'MMM d')}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: tx.paid_by === user?.id ? '#10B981' : '#374151' }}>${Number(tx.amount).toFixed(2)}</span>
              {tx.paid_by === user?.id && (
                <button onClick={() => deleteTransaction(tx.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </GlassPanel>
    </div>
  )
}
