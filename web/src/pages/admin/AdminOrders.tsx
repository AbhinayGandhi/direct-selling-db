import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL, useI18n, STATUS_LABEL } from '../../lib/i18n'
import { rpc, useAction, when } from '../../lib/act'
import { inr } from '../../lib/pricing'
import { Empty, ErrorBox, Loading } from '../../components/ui'

interface O {
  id: string; order_number: string; order_status: string; payment_status: string; total_amount: number; created_at: string
  shipping_details: Record<string, string>; courier_name: string | null; tracking_number: string | null; attributed_distributor_id: string | null
  order_items: { product_name_snapshot: string; quantity: number }[]; payments: { payment_method: string; payment_status: string; provider_reference: string | null }[]
}
const NEXT: Record<string, string[]> = { confirmed: ['processing', 'cancelled'], processing: ['shipped', 'cancelled'], shipped: ['delivered'], pending: ['cancelled'] }

async function load(status: string): Promise<O[]> {
  if (!supabase) throw new Error('x')
  let q = supabase.from('orders').select('id,order_number,order_status,payment_status,total_amount,created_at,shipping_details,courier_name,tracking_number,attributed_distributor_id,order_items(product_name_snapshot,quantity),payments(payment_method,payment_status,provider_reference)').order('created_at', { ascending: false }).limit(50)
  if (status) q = q.eq('order_status', status)
  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as O[]
}

export default function AdminOrders() {
  const L = useL(); const { lang } = useI18n()
  const [status, setStatus] = useState('')
  const list = useAsync(() => load(status), [status])
  const a = useAction(list.retry)
  const lab = (s: string) => STATUS_LABEL[s]?.[lang] ?? s

  function confirmPay(o: O) {
    const ref = window.prompt(L('पेमेंट संदर्भ क्रमांक (UPI/बँक UTR):', 'Payment reference (UPI/bank UTR):'))
    if (ref === null) return
    a.run(() => rpc('confirm_payment', { p_order_id: o.id, p_provider_reference: ref.trim() || null }))
  }
  function move(o: O, to: string) {
    let courier: string | null = null, tracking: string | null = null
    if (to === 'shipped') {
      courier = window.prompt(L('कुरिअरचे नाव:', 'Courier name:')); if (courier === null) return
      tracking = window.prompt(L('ट्रॅकिंग क्रमांक:', 'Tracking number:')); if (tracking === null) return
    }
    if (to === 'cancelled' && !window.confirm(L('ऑर्डर रद्द करायची? स्टॉक परत जमा होईल.', 'Cancel this order? Stock will be returned.'))) return
    a.run(() => rpc('update_order_status', { p_order_id: o.id, p_new_status: to, p_courier: courier || null, p_tracking: tracking || null }))
  }
  return (
    <>
      <h1>{L('ऑर्डर्स', 'Orders')}</h1>
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="status">
        <option value="">{L('सर्व', 'All')}</option>
        {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'return_requested', 'returned', 'refunded'].map((s) => <option key={s} value={s}>{lab(s)}</option>)}
      </select>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      {list.loading ? <Loading /> : list.error ? <ErrorBox onRetry={list.retry} /> : !list.data?.length ? <Empty>{L('ऑर्डर्स नाहीत.', 'No orders.')}</Empty> : (
        <ul className="orders">{list.data.map((o) => {
          const pay = o.payments[0]
          const canVerify = o.payment_status !== 'paid' && o.payment_status !== 'refunded' && pay && pay.payment_method !== 'online_provider' && !['cancelled'].includes(o.order_status)
          const sh = o.shipping_details
          return (
            <li key={o.id} className="card">
              <h3>{o.order_number} <span className="muted">{when(o.created_at)}</span></h3>
              <p>{o.order_items.map((i) => `${i.product_name_snapshot} × ${i.quantity}`).join(', ')}</p>
              <p><strong>{inr(o.total_amount)}</strong> · {lab(o.order_status)} · {L('पेमेंट', 'Payment')}: {lab(o.payment_status)} ({pay?.payment_method}{pay?.provider_reference ? ` · ${pay.provider_reference}` : ''})</p>
              <p className="muted">{sh.name}, {sh.phone}, {sh.address_line}, {sh.city}, {sh.state} {sh.pincode}</p>
              {o.attributed_distributor_id && <p className="muted">{L('वितरकाद्वारे विक्री', 'Referred by a distributor')}</p>}
              {o.tracking_number && <p>{o.courier_name} {o.tracking_number}</p>}
              <div className="row">
                {canVerify && <button className="btn primary" disabled={a.busy} onClick={() => confirmPay(o)}>{L('पेमेंट मिळाले (पडताळणी)', 'Payment received')}</button>}
                {o.order_status === 'pending' && pay?.payment_method === 'cash_on_delivery' && <button className="btn" disabled={a.busy} onClick={() => a.run(() => rpc('update_order_status', { p_order_id: o.id, p_new_status: 'confirmed' }))}>{L('COD ऑर्डर निश्चित करा', 'Confirm COD order')}</button>}
                {(NEXT[o.order_status] ?? []).map((to) => <button key={to} className="btn" disabled={a.busy} onClick={() => move(o, to)}>→ {lab(to)}</button>)}
              </div>
            </li>)
        })}</ul>)}
    </>
  )
}
