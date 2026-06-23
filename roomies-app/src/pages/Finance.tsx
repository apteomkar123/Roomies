import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useHousehold } from '../context/HouseholdContext'
import { useDebtMinimizer } from '../hooks/useDebtMinimizer'
import CanvasBg from '../components/ui/CanvasBg'
import GlassPanel from '../components/ui/GlassPanel'
import type { Transaction, TransactionSplit, Subscription, SubscriptionMember, RecurringBill } from '../types'
import { format, startOfMonth, endOfMonth } from 'date-fns'

type Category = 'Rent' | 'Groceries' | 'Utilities' | 'Shared Subscriptions' | 'Miscellaneous Ad-Hoc'
type Tab = 'bills' | 'rent' | 'recurring' | 'subscriptions'
const RECURRENCES = ['Monthly', 'Weekly', 'Bi-Weekly', 'Quarterly']
const CATEGORY_COLORS: Record<string, string> = {
  'Rent': '#2563EB', 'Groceries': '#10B981', 'Utilities': '#F59E0B',
  'Shared Subscriptions': '#8B5CF6', 'Miscellaneous Ad-Hoc': '#6B7280',
}

export default function Finance() {
  const { user, profile } = useAuth()
  const { household, memberProfiles } = useHousehold()
  const [tab, setTab] = useState<Tab>('bills')
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [splits, setSplits] = useState<TransactionSplit[]>([])

  // Add transaction form
  const [showAdd, setShowAdd] = useState(false)
  const [amount, setAmount] = useState('')
  const [memo, setMemo] = useState('')
  const [category, setCategory] = useState<Category>('Miscellaneous Ad-Hoc')
  const [splitEveryone, setSplitEveryone] = useState(true)
  const [customSplits, setCustomSplits] = useState<Record<string, string>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [settling, setSettling] = useState(false)
  const [settleError, setSettleError] = useState<string | null>(null)
  const [settleSuccess, setSettleSuccess] = useState(false)

  // Rent tracker
  const [rentMonth] = useState(new Date())

  // Recurring bills
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([])
  const [showAddRecurring, setShowAddRecurring] = useState(false)
  const [rbTitle, setRbTitle] = useState('')
  const [rbAmount, setRbAmount] = useState('')
  const [rbCategory, setRbCategory] = useState<Category>('Rent')
  const [rbRecurrence, setRbRecurrence] = useState('Monthly')
  const [rbDayOfMonth, setRbDayOfMonth] = useState('1')
  const [generatingId, setGeneratingId] = useState<string | null>(null)

  // Subscriptions
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [subMembers, setSubMembers] = useState<SubscriptionMember[]>([])
  const [showAddSub, setShowAddSub] = useState(false)
  const [subTitle, setSubTitle] = useState('')
  const [subCost, setSubCost] = useState('')
  const [subMemberIds, setSubMemberIds] = useState<string[]>([])

  const profileMap = Object.fromEntries(memberProfiles.map(p => [p.id, p.username]))
  const venmoMap = Object.fromEntries(memberProfiles.map(p => [p.id, p.venmo_username ?? null]))
  const { transfers, netBalances } = useDebtMinimizer(transactions, splits)
  const namedTransfers = transfers.map(t => ({ ...t, fromName: profileMap[t.from] ?? t.from, toName: profileMap[t.to] ?? t.to, toVenmo: venmoMap[t.to] ?? null }))
  const namedBalances = netBalances.map(b => ({ ...b, username: profileMap[b.profileId] ?? b.profileId }))
  const myDebtSplits = splits.filter(s => s.debtor_id === user?.id)
  const myVenmo = profile?.venmo_username ?? null

  useEffect(() => {
    if (!household) return
    loadAll()
    const ch = supabase.channel(`finance:${household.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transaction_splits' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_bills', filter: `household_id=eq.${household.id}` }, loadRecurring)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscriptions', filter: `household_id=eq.${household.id}` }, loadSubs)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'subscription_members' }, loadSubs)
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
    loadRecurring()
    loadSubs()
  }

  async function loadRecurring() {
    if (!household) return
    const { data } = await supabase.from('recurring_bills').select('*, profiles!created_by(username)').eq('household_id', household.id).order('created_at')
    setRecurringBills((data ?? []) as RecurringBill[])
  }

  async function loadSubs() {
    if (!household) return
    const { data: s } = await supabase.from('subscriptions').select('*, profiles!owner_id(username)').eq('household_id', household.id).order('started_at')
    const subList = (s ?? []) as Subscription[]
    setSubscriptions(subList)
    // Re-fetch members with correct IDs
    if (subList.length) {
      const { data: mm } = await supabase.from('subscription_members').select('*').in('subscription_id', subList.map(s => s.id))
      setSubMembers((mm ?? []) as SubscriptionMember[])
    } else {
      setSubMembers([])
    }
  }

  async function addTransaction() {
    if (!amount || parseFloat(amount) <= 0 || !household) return
    setSaveError(null)
    const { data: tx, error } = await supabase
      .from('transactions')
      .insert({ household_id: household.id, paid_by: user!.id, amount: parseFloat(amount), memo, category })
      .select().single()
    if (error) { setSaveError(error.message); return }
    if (tx) {
      if (splitEveryone) {
        const others = memberProfiles.filter(p => p.id !== user!.id)
        const share = parseFloat(amount) / memberProfiles.length
        await supabase.from('transaction_splits').insert(others.map(p => ({ transaction_id: tx.id, debtor_id: p.id, amount_owed: Math.round(share * 100) / 100 })))
      } else {
        const entries = Object.entries(customSplits).filter(([id, v]) => id !== user!.id && parseFloat(v) > 0)
        if (entries.length) {
          await supabase.from('transaction_splits').insert(entries.map(([id, v]) => ({ transaction_id: tx.id, debtor_id: id, amount_owed: Math.round(parseFloat(v) * 100) / 100 })))
        }
      }
    }
    setAmount(''); setMemo(''); setCustomSplits({}); setShowAdd(false); loadAll()
  }

  async function deleteTransaction(id: string) {
    await supabase.from('transaction_splits').delete().eq('transaction_id', id)
    await supabase.from('transactions').delete().eq('id', id)
    loadAll()
  }

  async function settleAll() {
    if (!household || settling) return
    setSettling(true); setSettleError(null); setSettleSuccess(false)
    const mySplitIds = myDebtSplits.map(s => s.id)
    if (mySplitIds.length) {
      const { error } = await supabase.from('transaction_splits').update({ settled: true }).in('id', mySplitIds)
      if (error) { setSettleError(error.message); setSettling(false); return }
    }
    const { data: remaining } = await supabase.from('transaction_splits').select('id').eq('settled', false).in('transaction_id', transactions.map(t => t.id)).limit(1)
    if (!remaining?.length) {
      supabase.from('cross_app_activity').insert({ user_id: user!.id, app: 'homebase', activity_type: 'all_bills_paid', is_public: true, payload: { household_id: household.id, message: 'All bills are paid! 🎉' } }).then(() => {})
    }
    setSettleSuccess(true); setTimeout(() => setSettleSuccess(false), 3000); setSettling(false); loadAll()
  }

  async function addRecurringBill() {
    if (!rbTitle.trim() || !rbAmount || parseFloat(rbAmount) <= 0 || !household) return
    setSaveError(null)
    const { error } = await supabase.from('recurring_bills').insert({
      household_id: household.id, created_by: user!.id, title: rbTitle.trim(),
      amount: parseFloat(rbAmount), category: rbCategory, recurrence: rbRecurrence,
      day_of_month: rbRecurrence === 'Monthly' ? parseInt(rbDayOfMonth) : null,
    })
    if (error) { setSaveError(error.message); return }
    setRbTitle(''); setRbAmount(''); setShowAddRecurring(false); loadRecurring()
  }

  async function generateRecurringBill(rb: RecurringBill) {
    if (!household) return
    setGeneratingId(rb.id)
    const { data: tx, error } = await supabase.from('transactions').insert({
      household_id: household.id, paid_by: user!.id, amount: rb.amount,
      memo: rb.title, category: rb.category,
    }).select().single()
    if (!error && tx && rb.split_equally) {
      const others = memberProfiles.filter(p => p.id !== user!.id)
      const share = rb.amount / memberProfiles.length
      await supabase.from('transaction_splits').insert(others.map(p => ({ transaction_id: tx.id, debtor_id: p.id, amount_owed: Math.round(share * 100) / 100 })))
    }
    await supabase.from('recurring_bills').update({ last_generated_at: new Date().toISOString() }).eq('id', rb.id)
    setGeneratingId(null); loadAll(); setTab('bills')
  }

  async function deleteRecurringBill(id: string) {
    await supabase.from('recurring_bills').delete().eq('id', id)
    loadRecurring()
  }

  async function addSubscription() {
    if (!subTitle.trim() || !subCost || parseFloat(subCost) <= 0 || !household) return
    setSaveError(null)
    const { data: sub, error } = await supabase.from('subscriptions').insert({
      household_id: household.id, owner_id: user!.id, title: subTitle.trim(), monthly_cost: parseFloat(subCost),
    }).select().single()
    if (error) { setSaveError(error.message); return }
    if (sub && subMemberIds.length) {
      await supabase.from('subscription_members').insert(subMemberIds.map(id => ({ subscription_id: sub.id, profile_id: id })))
    }
    setSubTitle(''); setSubCost(''); setSubMemberIds([]); setShowAddSub(false); loadSubs()
  }

  async function deleteSubscription(id: string) {
    await supabase.from('subscription_members').delete().eq('subscription_id', id)
    await supabase.from('subscriptions').delete().eq('id', id)
    loadSubs()
  }

  // Rent tracker logic
  const monthStart = startOfMonth(rentMonth).toISOString()
  const monthEnd = endOfMonth(rentMonth).toISOString()
  const rentTxThisMonth = transactions.filter(tx => tx.category === 'Rent' && tx.created_at >= monthStart && tx.created_at <= monthEnd)
  const paidMemberIds = new Set(rentTxThisMonth.map(tx => tx.paid_by))

  // Custom split helpers
  const totalCustom = Object.values(customSplits).reduce((s, v) => s + (parseFloat(v) || 0), 0)
  const totalAmt = parseFloat(amount) || 0

  const TABS: { id: Tab; label: string }[] = [
    { id: 'bills', label: '💰 Bills' },
    { id: 'rent', label: '🏠 Rent' },
    { id: 'recurring', label: '🔄 Recurring' },
    { id: 'subscriptions', label: '📺 Subscriptions' },
  ]

  return (
    <div style={{ minHeight: '100vh', padding: '24px 16px 40px', maxWidth: 700, margin: '0 auto' }}>
      <CanvasBg />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0, letterSpacing: '-0.5px' }}>Bills</h1>
          <div style={{ color: '#6B7280', fontSize: 14 }}>Split bills</div>
        </div>
        {tab === 'bills' && (
          <button onClick={() => setShowAdd(!showAdd)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
        )}
        {tab === 'recurring' && (
          <button onClick={() => setShowAddRecurring(!showAddRecurring)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
        )}
        {tab === 'subscriptions' && (
          <button onClick={() => setShowAddSub(!showAddSub)} style={{ background: 'linear-gradient(135deg,#2563EB,#8B5CF6)', color: 'white', border: 'none', borderRadius: 14, padding: '10px 18px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: '8px 16px', borderRadius: 999, border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', background: tab === t.id ? 'linear-gradient(135deg,#2563EB,#8B5CF6)' : 'rgba(0,0,0,0.06)', color: tab === t.id ? 'white' : '#374151' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── BILLS TAB ── */}
      {tab === 'bills' && (
        <>
          {showAdd && (
            <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
              {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
              <input className="glass-input" type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} style={{ marginBottom: 12 }} />
              <input className="glass-input" placeholder="Memo (e.g. Groceries run)" value={memo} onChange={e => setMemo(e.target.value)} style={{ marginBottom: 12 }} />
              <select value={category} onChange={e => setCategory(e.target.value as Category)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}>
                {(['Rent','Groceries','Utilities','Shared Subscriptions','Miscellaneous Ad-Hoc'] as Category[]).map(c => <option key={c}>{c}</option>)}
              </select>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: splitEveryone ? 16 : 12, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                <input type="checkbox" checked={splitEveryone} onChange={e => { setSplitEveryone(e.target.checked); setCustomSplits({}) }} style={{ width: 18, height: 18, accentColor: '#2563EB' }} />
                Split equally among all roommates
              </label>
              {!splitEveryone && memberProfiles.filter(p => p.id !== user?.id).length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>Custom amounts owed to you</div>
                  {memberProfiles.filter(p => p.id !== user?.id).map(p => (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>{p.username}</div>
                      <input
                        type="number"
                        placeholder="$0.00"
                        value={customSplits[p.id] ?? ''}
                        onChange={e => setCustomSplits(prev => ({ ...prev, [p.id]: e.target.value }))}
                        style={{ width: 90, padding: '8px 12px', borderRadius: 10, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 14, fontFamily: 'inherit' }}
                      />
                    </div>
                  ))}
                  {totalAmt > 0 && (
                    <div style={{ fontSize: 12, color: totalCustom > totalAmt ? '#E11D48' : '#6B7280', marginTop: 4, fontWeight: 600 }}>
                      Allocated: ${totalCustom.toFixed(2)} of ${totalAmt.toFixed(2)}
                      {totalCustom > totalAmt && ' — exceeds total!'}
                    </div>
                  )}
                </div>
              )}
              <button className="btn-blue" onClick={addTransaction}>Add Transaction</button>
            </GlassPanel>
          )}

          {namedTransfers.length > 0 && (
            <GlassPanel id="tut-finance" style={{ padding: 20, marginBottom: 20, border: '1.5px solid rgba(37,99,235,0.2)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Settle Up</div>
                {myDebtSplits.length > 0 ? (
                  <button onClick={settleAll} disabled={settling} style={{ padding: '6px 14px', borderRadius: 10, border: 'none', background: 'rgba(16,185,129,0.12)', color: '#059669', fontWeight: 700, cursor: settling ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 13, opacity: settling ? 0.7 : 1 }}>
                    {settling ? '…' : settleSuccess ? '✓ Marked Paid!' : 'Mark My Debts Paid'}
                  </button>
                ) : (
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#10B981', background: 'rgba(16,185,129,0.1)', borderRadius: 8, padding: '4px 10px' }}>✓ You're all paid up!</span>
                )}
              </div>
              {settleError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '8px 12px', color: '#E11D48', fontSize: 12, fontWeight: 600, marginBottom: 12 }}>{settleError}</div>}
              {namedTransfers.some(t => t.to === user?.id) && (
                <div style={{ background: 'rgba(0,140,255,0.06)', border: '1px solid rgba(0,140,255,0.15)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#008CFF', marginBottom: 4 }}>💸 You're owed money</div>
                  {myVenmo ? <div style={{ fontSize: 12, color: '#374151' }}>Share your Venmo <strong>@{myVenmo}</strong> with roommates so they can pay you.</div>
                    : <div style={{ fontSize: 12, color: '#6B7280' }}>Add your Venmo in <strong>Settings</strong> so roommates can pay you directly.</div>}
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
                    t.toVenmo
                      ? <a href={`https://venmo.com/${t.toVenmo}?txn=pay&amount=${t.amount.toFixed(2)}&note=HomeBase%20Bill`} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 6, padding: '6px 12px', borderRadius: 8, background: 'rgba(0,140,255,0.1)', color: '#008CFF', fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>💸 Pay via Venmo</a>
                      : <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>Ask {t.toName} to add their Venmo in Settings.</div>
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
        </>
      )}

      {/* ── RENT TRACKER TAB ── */}
      {tab === 'rent' && (
        <>
          <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Rent Tracker</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>{format(rentMonth, 'MMMM yyyy')}</div>
            {memberProfiles.length === 0 && <div style={{ color: '#9CA3AF', fontSize: 14 }}>No members yet.</div>}
            {memberProfiles.map(p => {
              const paid = paidMemberIds.has(p.id)
              const theirTx = rentTxThisMonth.filter(tx => tx.paid_by === p.id)
              return (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{paid ? '✅' : '⏳'}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{p.username}{p.id === user?.id && <span style={{ fontSize: 11, color: '#2563EB', marginLeft: 6 }}>You</span>}</div>
                      {theirTx.length > 0 && <div style={{ fontSize: 12, color: '#059669' }}>${theirTx.reduce((s, t) => s + Number(t.amount), 0).toFixed(2)} paid this month</div>}
                    </div>
                  </div>
                  <span style={{ fontWeight: 700, fontSize: 13, color: paid ? '#059669' : '#F59E0B', background: paid ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)', borderRadius: 999, padding: '4px 12px' }}>
                    {paid ? 'Paid' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </GlassPanel>
          {rentTxThisMonth.length === 0 && (
            <GlassPanel style={{ padding: 20, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)' }}>
              <div style={{ fontSize: 13, color: '#D97706', fontWeight: 600 }}>No rent transactions logged this month. Add one in the Bills tab with category "Rent".</div>
            </GlassPanel>
          )}
          {rentTxThisMonth.length > 0 && (
            <GlassPanel style={{ padding: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>Rent Transactions This Month</div>
              {rentTxThisMonth.map(tx => (
                <div key={tx.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{tx.memo || 'Rent'}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>by {tx.profiles?.username} · {format(new Date(tx.created_at), 'MMM d')}</div>
                  </div>
                  <span style={{ fontWeight: 800, color: '#2563EB' }}>${Number(tx.amount).toFixed(2)}</span>
                </div>
              ))}
            </GlassPanel>
          )}
        </>
      )}

      {/* ── RECURRING BILLS TAB ── */}
      {tab === 'recurring' && (
        <>
          {showAddRecurring && (
            <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Add Recurring Bill</div>
              {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
              <input className="glass-input" placeholder="Bill name (e.g. Rent, Netflix, Electricity)" value={rbTitle} onChange={e => setRbTitle(e.target.value)} style={{ marginBottom: 12 }} />
              <input className="glass-input" type="number" placeholder="Amount ($)" value={rbAmount} onChange={e => setRbAmount(e.target.value)} style={{ marginBottom: 12 }} />
              <select value={rbCategory} onChange={e => setRbCategory(e.target.value as Category)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}>
                {(['Rent','Groceries','Utilities','Shared Subscriptions','Miscellaneous Ad-Hoc'] as Category[]).map(c => <option key={c}>{c}</option>)}
              </select>
              <select value={rbRecurrence} onChange={e => setRbRecurrence(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'rgba(255,255,255,0.4)', fontSize: 15, marginBottom: 12, fontFamily: 'inherit' }}>
                {RECURRENCES.map(r => <option key={r}>{r}</option>)}
              </select>
              {rbRecurrence === 'Monthly' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 4 }}>Day of month</label>
                  <input type="number" className="glass-input" min="1" max="28" value={rbDayOfMonth} onChange={e => setRbDayOfMonth(e.target.value)} />
                </div>
              )}
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-blue" onClick={addRecurringBill}>Save</button>
                <button onClick={() => setShowAddRecurring(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
              </div>
            </GlassPanel>
          )}

          {recurringBills.length === 0 && !showAddRecurring && (
            <GlassPanel style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🔄</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No recurring bills</div>
              <div style={{ color: '#9CA3AF', fontSize: 14 }}>Add rent, utilities, or subscriptions that repeat on a schedule</div>
            </GlassPanel>
          )}

          {recurringBills.map(rb => (
            <GlassPanel key={rb.id} style={{ padding: 16, marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: CATEGORY_COLORS[rb.category] ?? '#6B7280', display: 'inline-block' }} />
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{rb.title}</span>
                    {!rb.is_active && <span style={{ background: 'rgba(0,0,0,0.06)', color: '#9CA3AF', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '1px 8px' }}>Paused</span>}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', fontWeight: 700, marginTop: 2 }}>${Number(rb.amount).toFixed(2)}</div>
                  <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>
                    {rb.recurrence}{rb.day_of_month ? ` · due on the ${rb.day_of_month}th` : ''} · {rb.split_equally ? 'Split equally' : 'No auto-split'}
                  </div>
                  {rb.last_generated_at && (
                    <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>Last generated: {format(new Date(rb.last_generated_at), 'MMM d, yyyy')}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <button
                    onClick={() => generateRecurringBill(rb)}
                    disabled={generatingId === rb.id}
                    style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: 'rgba(37,99,235,0.12)', color: '#2563EB', fontWeight: 700, cursor: generatingId === rb.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 12, whiteSpace: 'nowrap', opacity: generatingId === rb.id ? 0.6 : 1 }}
                  >
                    {generatingId === rb.id ? '…' : 'Generate Now'}
                  </button>
                  {rb.created_by === user?.id && (
                    <button onClick={() => deleteRecurringBill(rb.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
                  )}
                </div>
              </div>
            </GlassPanel>
          ))}

          <GlassPanel style={{ padding: 16, background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)', marginTop: 8 }}>
            <div style={{ fontSize: 12, color: '#D97706', fontWeight: 700, marginBottom: 4 }}>💡 How it works</div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>Recurring bills don't auto-post — tap "Generate Now" each billing period to create the transaction and split it among roommates.</div>
          </GlassPanel>
        </>
      )}

      {/* ── SUBSCRIPTIONS TAB ── */}
      {tab === 'subscriptions' && (
        <>
          {showAddSub && (
            <GlassPanel style={{ padding: 20, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Add Shared Subscription</div>
              {saveError && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)', borderRadius: 10, padding: '10px 14px', color: '#E11D48', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>{saveError}</div>}
              <input className="glass-input" placeholder="Service (e.g. Netflix, Spotify, Disney+)" value={subTitle} onChange={e => setSubTitle(e.target.value)} style={{ marginBottom: 12 }} />
              <input className="glass-input" type="number" placeholder="Monthly cost ($)" value={subCost} onChange={e => setSubCost(e.target.value)} style={{ marginBottom: 12 }} />
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', marginBottom: 8 }}>Who's on the plan?</div>
                {memberProfiles.map(p => (
                  <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>
                    <input type="checkbox" checked={subMemberIds.includes(p.id)} onChange={e => setSubMemberIds(prev => e.target.checked ? [...prev, p.id] : prev.filter(id => id !== p.id))} style={{ width: 18, height: 18, accentColor: '#2563EB' }} />
                    {p.username}{p.id === user?.id ? ' (you)' : ''}
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-blue" onClick={addSubscription}>Add Subscription</button>
                <button onClick={() => setShowAddSub(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, border: '1.5px solid rgba(200,210,230,0.5)', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}>Cancel</button>
              </div>
            </GlassPanel>
          )}

          {subscriptions.length === 0 && !showAddSub && (
            <GlassPanel style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>No subscriptions tracked</div>
              <div style={{ color: '#9CA3AF', fontSize: 14 }}>Add Netflix, Spotify, etc. to track who's on each plan and the monthly cost</div>
            </GlassPanel>
          )}

          {subscriptions.length > 0 && (
            <GlassPanel style={{ padding: 16, marginBottom: 16, background: 'rgba(139,92,246,0.04)', border: '1px solid rgba(139,92,246,0.15)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>Monthly Total</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#8B5CF6' }}>${subscriptions.reduce((s, sub) => s + Number(sub.monthly_cost), 0).toFixed(2)}</div>
            </GlassPanel>
          )}

          {subscriptions.map(sub => {
            const members = subMembers.filter(m => m.subscription_id === sub.id)
            const perPerson = members.length > 0 ? Number(sub.monthly_cost) / members.length : Number(sub.monthly_cost)
            return (
              <GlassPanel key={sub.id} style={{ padding: 16, marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 2 }}>{sub.title}</div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#8B5CF6', marginBottom: 4 }}>${Number(sub.monthly_cost).toFixed(2)}<span style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF' }}>/mo</span></div>
                    {members.length > 0 && (
                      <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>
                        {members.length} member{members.length > 1 ? 's' : ''} · ${perPerson.toFixed(2)}/person
                      </div>
                    )}
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>
                      Owned by {(sub.profiles as { username: string } | undefined)?.username ?? 'someone'}
                    </div>
                  </div>
                  {sub.owner_id === user?.id && (
                    <button onClick={() => deleteSubscription(sub.id)} style={{ padding: '6px 10px', borderRadius: 8, border: 'none', background: 'rgba(244,63,94,0.1)', color: '#E11D48', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12 }}>✕</button>
                  )}
                </div>
              </GlassPanel>
            )
          })}
        </>
      )}
    </div>
  )
}
