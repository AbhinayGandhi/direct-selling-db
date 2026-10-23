import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { imageUrl, type Product } from '../lib/data'
import { inr } from '../lib/pricing'

export function Price({ p }: { p: Product }) {
  const { t } = useI18n()
  const incl = p.applicable_tax_configuration?.inclusive ?? true
  const rate = p.applicable_tax_configuration?.gst_rate ?? 0
  return (
    <div className="price">
      <strong>{inr(p.selling_price)}</strong>
      {p.mrp > p.selling_price && <s>{t('mrp')} {inr(p.mrp)}</s>}
      {rate > 0 && <small>{incl ? t('gstIncl') : `${t('gstExcl')} ${rate}%`}</small>}
    </div>
  )
}

export default function ProductCard({ p }: { p: Product }) {
  const { t } = useI18n()
  const { add } = useCart()
  const img = imageUrl(p.image_path)
  return (
    <article className="card">
      <Link to={`/products/${p.id}`} className="thumb" aria-label={p.product_name}>
        {img ? <img src={img} alt="" loading="lazy" width={300} height={300} /> : <span aria-hidden="true">{p.product_name.slice(0, 1)}</span>}
      </Link>
      <h3><Link to={`/products/${p.id}`}>{p.product_name}</Link></h3>
      <Price p={p} />
      <p className={p.in_stock ? 'ok' : 'bad'}>{p.in_stock ? t('inStock') : t('outOfStock')}</p>
      <button className="btn primary" disabled={!p.in_stock} onClick={() => add(p.id)}>{t('addToCart')}</button>
    </article>
  )
}
