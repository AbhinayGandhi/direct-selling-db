import { useState } from 'react'
import { useI18n, STATUS_LABEL } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { useAsync } from '../lib/data'
import { inr } from '../lib/pricing'
import { Empty, ErrorBox, Loading } from '../components/ui'

interface Order {
  id: string; order_number: string; order_status: string; payment_status: string; total_amount: number; created_at: string
  tracking_number: string | null; courier_name: string | null; order_items: { product_name_snapshot: string; quantity: number }[]
}

async function load(): Promise<Order[]> {
  if (!supabase) throw new Error('not configured')
  const { data, error } = await supabase.from('orders')
    .select('id,order_number,order_status,payment_status,total_amount,created_at,tracking_number,courier_name,order_items(product_name_snapshot,quantity)')
    .order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as Order[]
}

export default function Orders() {
  const { t, lang } = useI18n()
  const list = useAsync(load, [])
  const [msg, setMsg] = useState<string | null>(null)
  const label = (s: string) => STATUS_LABEL[s]?.[lang] ?? s

  async function cancel(id: string) {
    if (!supabase) return
    const { error } = await supabase.rpc('cancel_my_order', { p_order_id: id, p_reason: 'customer request' })
    setMsg(error ? error.message : null)
    list.retry()
  }
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox onRetry={list.retry} />
  if (!list.data || list.data.length === 0) return <Empty>{t('noOrders')}</Empty>
  return (
    <>
      <h1>{t('orders')}</h1>
      {msg && <p className="banner warn" role="alert">{msg}</p>}
      <ul className="orders">
        {list.data.map((o) => (
          <li key={o.id} className="card">
            <h3>{o.order_number} <span className="muted">{new Date(o.created_at).toLocaleDateString(lang === 'mr' ? 'mr-IN' : 'en-IN')}</span></h3>
            <p>{o.order_items.map((i) => `${i.product_name_snapshot} × ${i.quantity}`).join(', ')}</p>
            <p>{t('status')}: <strong>{label(o.order_status)}</strong> · {t('payStatus')}: {label(o.payment_status)}</p>
            {o.tracking_number && <p>{t('tracking')}: {o.courier_name} {o.tracking_number}</p>}
            <p><strong>{inr(o.total_amount)}</strong></p>
            {['pending', 'confirmed'].includes(o.order_status) && <button className="btn" onClick={() => cancel(o.id)}>{t('cancelOrder')}</button>}
          </li>))}
      </ul>
    </>
  )
}
