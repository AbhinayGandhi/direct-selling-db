import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction, when } from '../../lib/act'
import { inr } from '../../lib/pricing'
import { Empty, ErrorBox, Loading } from '../../components/ui'

interface R { id: string; return_reason: string; quantity: number; refund_amount: number | null; return_status: string; refund_reference: string | null; created_at: string
  order_items: { product_name_snapshot: string; unit_price: number } | null; orders: { order_number: string } | null }
async function load(): Promise<R[]> {
  if (!supabase) throw new Error('x')
  const { data, error } = await supabase.from('returns').select('id,return_reason,quantity,refund_amount,return_status,refund_reference,created_at,order_items(product_name_snapshot,unit_price),orders(order_number)').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as unknown as R[]
}
export default function AdminReturns() {
  const L = useL(); const list = useAsync(load, []); const a = useAction(list.retry)
  function approve(r: R) {
    const restock = window.confirm(L('माल चांगल्या स्थितीत परत आला का? (OK = स्टॉकमध्ये परत जमा करा)', 'Is the item resellable? (OK = add back to stock)'))
    a.run(() => rpc('decide_return', { p_return_id: r.id, p_approve: true, p_restock: restock, p_refund_amount: null }))
  }
  function refund(r: R) {
    const ref = window.prompt(L('रिफंड संदर्भ क्रमांक (प्रत्यक्ष पैसे परत दिल्यानंतर):', 'Refund reference (after the money is actually returned):')); if (!ref) return
    a.run(() => rpc('record_refund', { p_return_id: r.id, p_refund_reference: ref }))
  }
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox onRetry={list.retry} />
  return (
    <>
      <h1>{L('रिटर्न/रिफंड', 'Returns & refunds')}</h1>
      <p className="muted">{L('मंजूर रिटर्नवर संबंधित कमिशन आपोआप उलटवले जाते.', 'Approving a return automatically reverses the related commission.')}</p>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      {!list.data?.length ? <Empty>{L('विनंत्या नाहीत.', 'No requests.')}</Empty> : <ul className="orders">{list.data.map((r) => (
        <li key={r.id} className="card">
          <h3>{r.orders?.order_number} <span className="muted">{when(r.created_at)}</span></h3>
          <p>{r.order_items?.product_name_snapshot} × {r.quantity} · {r.return_status}{r.refund_amount !== null && ` · ${inr(r.refund_amount)}`}</p>
          <p className="muted">{r.return_reason}</p>{r.refund_reference && <p className="muted">Ref: {r.refund_reference}</p>}
          <div className="row">
            {r.return_status === 'requested' && <><button className="btn primary" disabled={a.busy} onClick={() => approve(r)}>{L('मंजूर', 'Approve')}</button>
              <button className="btn" disabled={a.busy} onClick={() => a.run(() => rpc('decide_return', { p_return_id: r.id, p_approve: false, p_restock: false, p_refund_amount: null }))}>{L('नाकारा', 'Reject')}</button></>}
            {r.return_status === 'approved' && <button className="btn primary" disabled={a.busy} onClick={() => refund(r)}>{L('रिफंड नोंदवा', 'Record refund')}</button>}
          </div>
        </li>))}</ul>}
    </>
  )
}
