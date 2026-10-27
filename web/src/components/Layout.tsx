import { Link, NavLink, Outlet } from 'react-router-dom'
import { useI18n, useL } from '../lib/i18n'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { isConfigured } from '../lib/supabase'
import { fetchCompany, useAsync } from '../lib/data'

export default function Layout() {
  const { t, toggle } = useI18n()
  const { session, profile, signOut } = useAuth()
  const L = useL()
  const { count } = useCart()
  const company = useAsync(fetchCompany, [])
  const c = company.data
  return (
    <>
      <header className="top">
        <Link to="/" className="brand">{c?.legal_business_name || 'Store'}</Link>
        <nav aria-label="main">
          <NavLink to="/products">{t('products')}</NavLink>
          <NavLink to="/cart">{t('cart')}{count > 0 && <b className="badge" aria-label={`${count}`}>{count}</b>}</NavLink>
          {session ? <NavLink to="/orders">{t('orders')}</NavLink> : <NavLink to="/login">{t('login')}</NavLink>}
          {session && <NavLink to="/support">{L('मदत', 'Support')}</NavLink>}
          {session && <NavLink to="/distributor">{L('वितरक', 'Distributor')}</NavLink>}
          {(profile?.role === 'staff' || profile?.role === 'admin') && <NavLink to="/admin">{L('अॅडमिन', 'Admin')}</NavLink>}
          {session && <button className="link" onClick={() => signOut()}>{t('logout')}</button>}
          <button className="link" onClick={toggle} lang={t('language') === 'English' ? 'en' : 'mr'}>{t('language')}</button>
        </nav>
      </header>
      {!isConfigured && <p className="banner warn" role="alert">{t('notConfigured')}</p>}
      <main><Outlet /></main>
      <footer className="foot">
        <nav aria-label="policies">
          {(['shipping', 'returns', 'privacy', 'terms', 'grievance', 'distributor-terms'] as const).map((p) => (
            <Link key={p} to={`/policy/${p}`}>{t(p === 'distributor-terms' ? 'distTerms' : p)}</Link>))}
          <Link to="/contact">{t('contact')}</Link>
        </nav>
      </footer>
    </>
  )
}
