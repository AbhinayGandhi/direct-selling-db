import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAsync } from '../lib/data'
import { useL } from '../lib/i18n'
import { rpc, useAction, when } from '../lib/act'
import { inr } from '../lib/pricing'
import { Empty, ErrorBox, Field, Loading } from '../components/ui'

interface Me { id: string; distributor_code: string | null; application_status: string }
interface Com { id: string; commission_status: string; qualifying_sales_amount: number; commission_rate_snapshot: number; commission_amount: number; reversal_of_commission_id: string | null; created_at: string }
interface Sale { order_id: string; order_number: string; order_status: string; created_at: string; subtotal: number }
interface Pay { id: string; amount: number; payout_status: string; paid_at: string | null; created_at: string }

async function load() {
  if (!supabase) throw new Error('x')
  const me = await supabase.from('distributors').select('id,distributor_code,application_status').maybeSingle()
  if (me.error) throw me.error
  const m = me.data as Me | null
  if (!m || m.application_status !== 'approved') return { me: m, coms: [] as Com[], sales: [] as Sale[], pays: [] as Pay[], balance: 0 }
  const [c, s, p, b] = await Promise.all([
    supabase.from('sales_commissions').select('id,commission_status,qualifying_sales_amount,commission_rate_snapshot,commission_amount,reversal_of_commission_id,created_at').order('created_at', { ascending: false }).limit(100),
    supabase.from('distributor_sales').select('*').order('created_at', { ascending: false }).limit(100),
    supabase.from('payouts').select('id,amount,payout_status,paid_at,created_at').order('created_at', { ascending: false }).limit(50),
    supabase.rpc('distributor_payable_balance', { p_distributor_id: m.id })])
  if (c.error || s.error || p.error || b.error) throw new Error('x')
  return { me: m, coms: (c.data ?? []) as Com[], sales: (s.data ?? []) as Sale[], pays: (p.data ?? []) as Pay[], balance: Number(b.data ?? 0) }
}

export default function Distributor() {
  const L = useL(); const d = useAsync(load, []); const a = useAction(d.retry)
  const [sponsor, setSponsor] = useState(''); const [agree, setAgree] = useState(false)
  if (d.loading) return <Loading />
  if (d.error || !d.data) return <ErrorBox onRetry={d.retry} />
  const { me, coms, sales, pays, balance } = d.data

  if (!me) return (
    <form className="form" onSubmit={(e: FormEvent) => { e.preventDefault(); a.run(() => rpc('apply_distributor', { p_sponsor_code: sponsor.trim() || null, p_agreement_version: 'draft-v1' })) }}>
      <h1>{L('वितरक अर्ज', 'Distributor application')}</h1>
      <ul>
        <li>{L('कोणतेही शुल्क नाही आणि स्टॉक खरेदी आवश्यक नाही.', 'No fee and no stock purchase is required.')}</li>
        <li>{L('मोबदला फक्त प्रत्यक्ष पात्र उत्पादन विक्रीवर. सदस्य जोडल्याबद्दल मोबदला नाही. उत्पन्नाची हमी नाही.', 'Compensation only on genuine eligible product sales. Nothing for recruiting. No income is guaranteed.')}</li>
        <li>{L('मोबदला देणे सध्या बंद असू शकते.', 'Payouts may currently be switched off.')}</li>
      </ul>
      <Field label={L('प्रायोजक कोड (असल्यास, पर्यायी)', 'Sponsor code (optional)')}><input value={sponsor} onChange={(e) => setSponsor(e.target.value)} /></Field>
      <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {L('मी ', 'I have read the ')}<Link to="/policy/distributor-terms">{L('वितरक अटी', 'distributor terms')}</Link>{L(' वाचल्या आहेत आणि मान्य आहेत.', ' and accept them.')}</label>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      <button className="btn primary block" disabled={!agree || a.busy}>{L('अर्ज करा', 'Apply')}</button>
    </form>)

  if (me.application_status !== 'approved') return <p className="banner warn">{L('तुमचा अर्ज स्थिती: ', 'Your application status: ')}<strong>{me.application_status}</strong></p>

  const link = `${window.location.origin}${import.meta.env.BASE_URL}?ref=${me.distributor_code}`
  return (
    <>
      <h1>{L('वितरक पोर्टल', 'Distributor portal')}</h1>
      <div className="card"><p>{L('तुमचा कोड', 'Your code')}: <strong>{me.distributor_code}</strong></p><p className="muted" style={{ wordBreak: 'break-all' }}>{link}</p>
        <button className="btn" onClick={() => navigator.clipboard?.writeText(link)}>{L('लिंक कॉपी', 'Copy link')}</button></div>
      <p className="banner warn">{L('ही रक्कम "मंजूर देय शिल्लक" आहे. प्रलंबित नोंदी अजून देय नाहीत. उत्पन्नाची हमी नाही.', 'This is the "approved payable balance". Pending entries are not yet payable. No income is guaranteed.')}</p>
      <div className="card"><span>{L('मंजूर देय शिल्लक', 'Approved payable balance')}</span><strong className="big">{inr(balance)}</strong></div>
      <h2>{L('माझ्या विक्री (ग्राहकाची माहिती दिसत नाही)', 'My sales (no customer details shown)')}</h2>
      {!sales.length ? <Empty>{L('विक्री नाही.', 'No sales yet.')}</Empty> : <ul className="orders">{sales.map((s) => <li key={s.order_id} className="card">{s.order_number} · {s.order_status} · {inr(s.subtotal)} <span className="muted">{when(s.created_at)}</span></li>)}</ul>}
      <h2>{L('कमिशन नोंदवही', 'Commission ledger')}</h2>
      {!coms.length ? <Empty>{L('नोंदी नाहीत.', 'No entries.')}</Empty> : <ul className="orders">{coms.map((c) => (
        <li key={c.id} className="card">{c.reversal_of_commission_id ? L('उलटवणे', 'Reversal') : L('विक्री', 'Sale')}: {inr(c.qualifying_sales_amount)} × {(c.commission_rate_snapshot * 100).toFixed(2)}% = <strong>{inr(c.commission_amount)}</strong> · {c.commission_status} <span className="muted">{when(c.created_at)}</span></li>))}</ul>}
      <h2>{L('पेआउट इतिहास', 'Payout history')}</h2>
      {!pays.length ? <Empty>{L('पेआउट नाहीत.', 'No payouts.')}</Empty> : <ul className="orders">{pays.map((p) => <li key={p.id} className="card">{inr(p.amount)} · {p.payout_status} <span className="muted">{when(p.paid_at ?? p.created_at)}</span></li>)}</ul>}
    </>
  )
}
