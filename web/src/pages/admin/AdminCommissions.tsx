import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction, num, when } from '../../lib/act'
import { inr } from '../../lib/pricing'
import { ErrorBox, Field, Loading } from '../../components/ui'

interface C { id: string; commission_status: string; qualifying_sales_amount: number; commission_rate_snapshot: number; commission_amount: number; reversal_of_commission_id: string | null; created_at: string
  distributors: { distributor_code: string | null } | null; orders: { order_number: string } | null }
interface Rule { id: string; rule_name: string; commission_rate: number; effective_from: string; effective_until: string | null; active: boolean; approved_by: string | null }
async function load() {
  if (!supabase) throw new Error('x')
  const [c, r, s] = await Promise.all([
    supabase.from('sales_commissions').select('id,commission_status,qualifying_sales_amount,commission_rate_snapshot,commission_amount,reversal_of_commission_id,created_at,distributors(distributor_code),orders(order_number)').order('created_at', { ascending: false }).limit(100),
    supabase.from('commission_rules').select('*').order('created_at', { ascending: false }),
    supabase.from('company_settings').select('live_commission_enabled,compliance_review_status').maybeSingle()])
  if (c.error || r.error || s.error) throw new Error('x')
  return { rows: (c.data ?? []) as unknown as C[], rules: (r.data ?? []) as Rule[], live: s.data as { live_commission_enabled: boolean; compliance_review_status: string } | null }
}
export default function AdminCommissions() {
  const L = useL(); const d = useAsync(load, []); const a = useAction(d.retry)
  const [f, setF] = useState({ name: '', pct: '', from: new Date().toISOString().slice(0, 10) })
  function create(e: FormEvent) {
    e.preventDefault()
    const pct = num(f.pct); if (pct === null || pct < 0 || pct > 50) { window.alert(L('टक्केवारी 0 ते 50 असावी.', 'Percentage must be 0 to 50.')); return }
    a.run(() => rpc('create_commission_rule', { p_name: f.name, p_rate: pct / 100, p_from: f.from, p_until: null }))
  }
  if (d.loading) return <Loading />
  if (d.error || !d.data) return <ErrorBox onRetry={d.retry} />
  const { rows, rules, live } = d.data
  const pending = rows.filter((r) => r.commission_status === 'pending').map((r) => r.id)
  return (
    <>
      <h1>{L('कमिशन', 'Commissions')}</h1>
      <p className={live?.live_commission_enabled ? 'banner ok' : 'banner warn'}>{live?.live_commission_enabled ? L('कमिशन चालू आहे.', 'Commission is ON.') : L('कमिशन बंद आहे (कायदेशीर पुनरावलोकन मंजूर झाल्यावर सेटिंग्जमधून चालू होईल). बंद असताना नवीन कमिशन तयार होत नाही.', 'Commission is OFF (it can be switched on in Settings only after the compliance review is approved). No new commission is created while off.')}</p>
      <p className="muted">{L('फक्त प्रत्यक्ष, पात्र उत्पादन विक्रीवर टक्केवारी (GST आणि डिलिव्हरी वगळून). भरती/नोंदणीवर कमिशन नाही.', 'Percentage of genuine eligible product sales only (excluding GST and delivery). No commission for recruitment or registration.')}</p>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      <h2>{L('दर नियम', 'Rate rules')}</h2>
      <form className="form wide" onSubmit={create}>
        <Field label={L('नियमाचे नाव', 'Rule name')}><input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <Field label={L('टक्केवारी %', 'Percent %')}><input required inputMode="decimal" value={f.pct} onChange={(e) => setF({ ...f, pct: e.target.value })} /></Field>
        <Field label={L('पासून', 'Effective from')}><input required type="date" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} /></Field>
        <button className="btn block" disabled={a.busy}>{L('नियम तयार करा (मंजुरीशिवाय निष्क्रिय)', 'Create rule (inactive until approved)')}</button>
      </form>
      <ul className="orders">{rules.map((r) => (
        <li key={r.id} className="card"><h3>{r.rule_name} · {(r.commission_rate * 100).toFixed(2)}%</h3><p>{r.effective_from} {r.active ? '· ✔' : L('· निष्क्रिय', '· inactive')}</p>
          {!r.approved_by && <button className="btn primary" disabled={a.busy} onClick={() => window.confirm(L('हा दर मंजूर करायचा?', 'Approve this rate?')) && a.run(() => rpc('approve_commission_rule', { p_rule_id: r.id }))}>{L('मंजूर करा', 'Approve')}</button>}</li>))}</ul>
      <h2>{L('कमिशन नोंदवही', 'Commission ledger')}</h2>
      {pending.length > 0 && <button className="btn primary" disabled={a.busy} onClick={() => window.confirm(L(`${pending.length} प्रलंबित नोंदी मंजूर करायच्या?`, `Approve ${pending.length} pending entries?`)) && a.run(() => rpc('approve_commissions', { p_ids: pending }).then((e) => e))}>{L('सर्व प्रलंबित मंजूर', 'Approve all pending')} ({pending.length})</button>}
      <ul className="orders">{rows.map((r) => (
        <li key={r.id} className="card">
          <h3>{r.orders?.order_number} · {r.distributors?.distributor_code} <span className="muted">{when(r.created_at)}</span></h3>
          <p>{r.reversal_of_commission_id ? L('उलटवणे (रिटर्न)', 'Reversal (return)') : L('विक्री', 'Sale')}: {inr(r.qualifying_sales_amount)} × {(r.commission_rate_snapshot * 100).toFixed(2)}% = <strong>{inr(r.commission_amount)}</strong> · {r.commission_status}</p>
        </li>))}</ul>
    </>
  )
}
