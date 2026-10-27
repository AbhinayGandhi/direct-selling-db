import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { ErrorBox, Loading } from '../../components/ui'

async function count(table: string, col: string, val: string | string[]) {
  if (!supabase) throw new Error('x')
  let q = supabase.from(table).select('id', { count: 'exact', head: true })
  q = Array.isArray(val) ? q.in(col, val) : q.eq(col, val)
  const { count: c, error } = await q
  if (error) throw error
  return c ?? 0
}
async function loadAll() {
  const [pay, ord, ret, cmp, dist] = await Promise.all([
    count('orders', 'payment_status', ['pending_verification', 'pending']), count('orders', 'order_status', ['confirmed', 'processing']),
    count('returns', 'return_status', 'requested'), count('complaints', 'status', ['open', 'in_progress']), count('distributors', 'application_status', 'pending'),
  ])
  if (!supabase) throw new Error('x')
  const { data } = await supabase.from('products').select('product_name,stock_quantity,low_stock_threshold').eq('stock_tracking_enabled', true)
  const low = ((data ?? []) as { product_name: string; stock_quantity: number; low_stock_threshold: number }[]).filter((p) => p.stock_quantity <= p.low_stock_threshold)
  return { pay, ord, ret, cmp, dist, low }
}

// Real counts only. Nothing here is estimated or invented.
export default function Overview() {
  const L = useL()
  const d = useAsync(loadAll, [])
  if (d.loading) return <Loading />
  if (d.error || !d.data) return <ErrorBox onRetry={d.retry} />
  const x = d.data
  const cards: [string, number][] = [
    [L('पेमेंट पडताळणी प्रलंबित', 'Awaiting payment check'), x.pay], [L('पाठवायच्या ऑर्डर्स', 'To fulfil'), x.ord],
    [L('रिटर्न विनंत्या', 'Return requests'), x.ret], [L('उघड्या तक्रारी', 'Open complaints'), x.cmp],
    [L('वितरक अर्ज', 'Distributor applications'), x.dist], [L('कमी स्टॉक', 'Low stock'), x.low.length],
  ]
  return (
    <>
      <h1>{L('सारांश', 'Overview')}</h1>
      <div className="grid stats">{cards.map(([k, v]) => <div className="card" key={k}><strong className="big">{v}</strong><span>{k}</span></div>)}</div>
      {x.low.length > 0 && <p className="banner warn">{L('कमी स्टॉक: ', 'Low stock: ')}{x.low.map((p) => `${p.product_name} (${p.stock_quantity})`).join(', ')}</p>}
    </>
  )
}
