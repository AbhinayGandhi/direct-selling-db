import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { fetchCompany, fetchProductsByIds, useAsync } from '../lib/data'
import { estimate, inr } from '../lib/pricing'
import { Empty, ErrorBox, Loading } from '../components/ui'

export function useCartDetails() {
  const { lines } = useCart()
  const ids = lines.map((l) => l.productId).sort()
  const prods = useAsync(() => fetchProductsByIds(ids), [ids.join(',')])
  const company = useAsync(fetchCompany, [])
  const byId = new Map((prods.data ?? []).map((p) => [p.id, p]))
  const rows = lines.map((l) => ({ line: l, p: byId.get(l.productId) }))
  const valid = rows.filter((r) => r.p && r.p.in_stock)
  const est = estimate(valid.map((r) => ({ price: r.p!.selling_price, qty: r.line.qty, cfg: r.p!.applicable_tax_configuration })),
    company.data?.delivery_charge ?? 0, company.data?.free_delivery_above ?? null)
  return { rows, est, loading: prods.loading, error: prods.error, retry: prods.retry, hasInvalid: valid.length !== rows.length }
}

export default function Cart() {
  const { t } = useI18n()
  const { setQty, remove, lines } = useCart()
  const d = useCartDetails()
  if (lines.length === 0) return <Empty>{t('emptyCart')} <Link to="/products">{t('browse')}</Link></Empty>
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox onRetry={d.retry} />
  return (
    <>
      <h1>{t('cart')}</h1>
      {d.hasInvalid && <p className="banner warn" role="alert">{t('unavailableInCart')}</p>}
      <ul className="lines">
        {d.rows.map(({ line, p }) => (
          <li key={line.productId}>
            <div><strong>{p ? p.product_name : '—'}</strong>{p && <div className="muted">{inr(p.selling_price)}</div>}{(!p || !p.in_stock) && <div className="bad">{t('outOfStock')}</div>}</div>
            <label className="qty"><span className="sr">{t('qty')}</span>
              <input type="number" inputMode="numeric" min={1} max={100} value={line.qty} onChange={(e) => setQty(line.productId, Number(e.target.value))} /></label>
            <button className="link" onClick={() => remove(line.productId)}>{t('remove')}</button>
          </li>))}
      </ul>
      <Totals est={d.est} />
      <Link className={`btn primary block${d.hasInvalid ? ' disabled' : ''}`} to={d.hasInvalid ? '#' : '/checkout'} aria-disabled={d.hasInvalid}>{t('checkout')}</Link>
    </>
  )
}

export function Totals({ est }: { est: { subtotal: number; tax: number; delivery: number; total: number } }) {
  const { t } = useI18n()
  return (
    <dl className="totals">
      <dt>{t('subtotal')}</dt><dd>{inr(est.subtotal)}</dd>
      <dt>{t('tax')}</dt><dd>{inr(est.tax)}</dd>
      <dt>{t('delivery')}</dt><dd>{inr(est.delivery)}</dd>
      <dt className="grand">{t('total')}</dt><dd className="grand">{inr(est.total)}</dd>
      <dd className="note">{t('estimateNote')}</dd>
    </dl>
  )
}
