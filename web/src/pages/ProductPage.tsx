import { useParams } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { fetchCompany, fetchProduct, imageUrl, useAsync } from '../lib/data'
import { Price } from '../components/ProductCard'
import { Empty, ErrorBox, Loading } from '../components/ui'

export default function ProductPage() {
  const { id = '' } = useParams()
  const { t } = useI18n()
  const { add } = useCart()
  const prod = useAsync(() => fetchProduct(id), [id])
  const company = useAsync(fetchCompany, [])
  if (prod.loading) return <Loading />
  if (prod.error) return <ErrorBox onRetry={prod.retry} />
  const p = prod.data
  if (!p) return <Empty>{t('noProducts')}</Empty>
  const img = imageUrl(p.image_path)
  const c = company.data
  return (
    <article className="detail">
      <div className="thumb big">{img ? <img src={img} alt={p.product_name} width={600} height={600} /> : <span aria-hidden="true">{p.product_name.slice(0, 1)}</span>}</div>
      <div>
        <h1>{p.product_name}</h1>
        <p className="muted">SKU {p.sku}</p>
        <Price p={p} />
        <p className={p.in_stock ? 'ok' : 'bad'}>{p.in_stock ? t('inStock') : t('outOfStock')}</p>
        {p.description && <p>{p.description}</p>}
        <p className="muted">{t('deliveryInfo')}{c && c.delivery_charge > 0 ? ` (₹${c.delivery_charge}${c.free_delivery_above ? ` / ₹${c.free_delivery_above}+ free` : ''})` : ''}</p>
        <button className="btn primary" disabled={!p.in_stock} onClick={() => add(p.id)}>{t('addToCart')}</button>
      </div>
    </article>
  )
}
