import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction, num, when } from '../../lib/act'
import { inr } from '../../lib/pricing'
import { ErrorBox, Loading } from '../../components/ui'

interface Dist { id: string; distributor_code: string | null; profiles: { full_name: string | null } | null; balance: number }
interface Pay { id: string; amount: number; payout_status: string; approval_reference: string | null; payment_reference: string | null; created_at: string; distributors: { distributor_code: string | null } | null }
async function load() {
  if (!supabase) throw new Error('x')
  const [dd, pp, ss] = await Promise.all([
    supabase.from('distributors').select('id,distributor_code,profiles(full_name)').eq('application_status', 'approved'),
    supabase.from('payouts').select('id,amount,payout_status,approval_reference,payment_reference,created_at,distributors(distributor_code)').order('created_at', { ascending: false }).limit(100),
    supabase.from('company_settings').select('live_commission_enabled,compliance_review_status').maybeSingle()])
  if (dd.error || pp.error || ss.error) throw new Error('x')
  const dists = await Promise.all(((dd.data ?? []) as unknown as Omit<Dist, 'balance'>[]).map(async (x) => {
    const { data } = await supabase!.rpc('distributor_payable_balance', { p_distributor_id: x.id })
    return { ...x, balance: Number(data ?? 0) }
  }))
  return { dists, pays: (pp.data ?? []) as unknown as Pay[], s: ss.data as { live_commission_enabled: boolean; compliance_review_status: string } | null }
}
export default function AdminPayouts() {
  const L = useL(); const d = useAsync(load, []); const a = useAction(d.retry)
  if (d.loading) return <Loading />
  if (d.error || !d.data) return <ErrorBox onRetry={d.retry} />
  const enabled = !!d.data.s?.live_commission_enabled && d.data.s.compliance_review_status === 'approved'
  function request(x: Dist) {
    const amt = num(window.prompt(L(`रक्कम (शिल्लक ${inr(x.balance)}):`, `Amount (balance ${inr(x.balance)}):`)) ?? ''); if (amt === null) return
    a.run(() => rpc('request_payout', { p_distributor_id: x.id, p_amount: amt }))
  }
  function approve(p: Pay) { const r = window.prompt(L('मंजुरी संदर्भ (उदा. तुमच्या नोंदीतील क्रमांक):', 'Approval reference:')); if (r) a.run(() => rpc('approve_payout', { p_payout_id: p.id, p_approval_reference: r })) }
  function paid(p: Pay) { const r = window.prompt(L('प्रत्यक्ष पेमेंट संदर्भ (UTR) — पैसे दिल्यानंतरच:', 'Payment reference (UTR) — only after money is sent:')); if (r) a.run(() => rpc('mark_payout_paid', { p_payout_id: p.id, p_payment_reference: r })) }
  function fail(p: Pay) { const r = window.prompt(L('कारण:', 'Reason:')); if (r) a.run(() => rpc('fail_or_reverse_payout', { p_payout_id: p.id, p_reason: r })) }
  return (
    <>
      <h1>{L('पेआउट', 'Payouts')}</h1>
      {!enabled && <p className="banner warn">{L('पेआउट बंद आहेत: कायदेशीर पुनरावलोकन मंजूर होईपर्यंत नवीन पेआउट तयार करता येत नाहीत.', 'Payouts are OFF: no new payout can be created until the compliance review is approved.')}</p>}
      <p className="muted">{L('हे अॅप पैसे आपोआप पाठवत नाही. तुम्ही बँक/UPI मधून स्वतः पैसे द्या आणि नंतर संदर्भ क्रमांक नोंदवा.', 'This app never sends money. You pay from your bank/UPI yourself and then record the reference.')}</p>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      <h2>{L('मंजूर वितरक व देय शिल्लक', 'Approved distributors and payable balance')}</h2>
      <ul className="orders">{d.data.dists.map((x) => (
        <li key={x.id} className="card"><h3>{x.profiles?.full_name} · {x.distributor_code}</h3><p>{L('देय शिल्लक', 'Payable')}: <strong>{inr(x.balance)}</strong></p>
          {enabled && x.balance > 0 && <button className="btn" disabled={a.busy} onClick={() => request(x)}>{L('पेआउट विनंती', 'Request payout')}</button>}</li>))}</ul>
      <h2>{L('पेआउट नोंदी', 'Payout records')}</h2>
      <ul className="orders">{d.data.pays.map((p) => (
        <li key={p.id} className="card"><h3>{p.distributors?.distributor_code} · {inr(p.amount)} <span className="muted">{when(p.created_at)}</span></h3>
          <p>{p.payout_status}{p.approval_reference && ` · ${p.approval_reference}`}{p.payment_reference && ` · ${p.payment_reference}`}</p>
          <div className="row">
            {p.payout_status === 'pending_approval' && <button className="btn primary" disabled={a.busy} onClick={() => approve(p)}>{L('मंजूर', 'Approve')}</button>}
            {p.payout_status === 'approved' && <button className="btn primary" disabled={a.busy} onClick={() => paid(p)}>{L('दिले म्हणून नोंदवा', 'Mark paid')}</button>}
            {['pending_approval', 'approved', 'paid'].includes(p.payout_status) && <button className="btn" disabled={a.busy} onClick={() => fail(p)}>{p.payout_status === 'paid' ? L('उलटले', 'Reverse') : L('अयशस्वी', 'Fail')}</button>}
          </div></li>))}</ul>
    </>
  )
}
