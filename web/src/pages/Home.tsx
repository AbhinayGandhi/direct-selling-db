import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { fetchProducts, useAsync } from '../lib/data'
import ProductCard from '../components/ProductCard'
import { Empty, ErrorBox, Loading } from '../components/ui'

export default function Home() {
  const { t } = useI18n()
  const list = useAsync(() => fetchProducts(0, '', ''), [])
  return (
    <>
      <section className="hero">
        <h1>{t('heroTitle')}</h1>
        <p>{t('heroText')}</p>
        <Link className="btn primary" to="/products">{t('browse')}</Link>
      </section>
      {list.loading ? <Loading /> : list.error ? <ErrorBox onRetry={list.retry} /> :
        list.data && list.data.rows.length > 0
          ? <div className="grid">{list.data.rows.slice(0, 6).map((p) => <ProductCard key={p.id} p={p} />)}</div>
          : <Empty>{t('noProducts')}</Empty>}
    </>
  )
}
