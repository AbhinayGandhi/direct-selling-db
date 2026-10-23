import { useState } from 'react'
import { useI18n } from '../lib/i18n'
import { fetchCategories, fetchProducts, useAsync } from '../lib/data'
import ProductCard from '../components/ProductCard'
import { Empty, ErrorBox, Loading } from '../components/ui'

export default function Catalog() {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [cat, setCat] = useState('')
  const [page, setPage] = useState(0)
  const cats = useAsync(fetchCategories, [])
  const list = useAsync(() => fetchProducts(page, applied, cat), [page, applied, cat])
  return (
    <>
      <form className="filters" role="search" onSubmit={(e) => { e.preventDefault(); setPage(0); setApplied(q) }}>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
        <select value={cat} aria-label={t('allCategories')} onChange={(e) => { setPage(0); setCat(e.target.value) }}>
          <option value="">{t('allCategories')}</option>
          {(cats.data ?? []).map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}
        </select>
        <button className="btn primary" type="submit">{t('search')}</button>
      </form>
      {list.loading ? <Loading /> : list.error ? <ErrorBox onRetry={list.retry} /> :
        list.data && list.data.rows.length > 0 ? (
          <>
            <div className="grid">{list.data.rows.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            <div className="pager">
              <button className="btn" disabled={page === 0} onClick={() => setPage(page - 1)}>{t('prev')}</button>
              <button className="btn" disabled={!list.data.more} onClick={() => setPage(page + 1)}>{t('next')}</button>
            </div>
          </>
        ) : <Empty>{t('noProducts')}</Empty>}
    </>
  )
}
