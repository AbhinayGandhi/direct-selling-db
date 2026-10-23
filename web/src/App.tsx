import { useEffect } from 'react'
import { Route, Routes, useSearchParams } from 'react-router-dom'
import Layout from './components/Layout'
import RequireAuth from './components/RequireAuth'
import Home from './pages/Home'
import Catalog from './pages/Catalog'
import ProductPage from './pages/ProductPage'
import Cart from './pages/Cart'
import Checkout from './pages/Checkout'
import Login from './pages/Login'
import Orders from './pages/Orders'
import Policy from './pages/Policy'
import Contact from './pages/Contact'

export default function App() {
  const [params] = useSearchParams()
  // ?ref=CODE remembers a distributor code. It is only a suggestion: the server verifies it and decides attribution.
  useEffect(() => {
    const r = params.get('ref')
    if (r && /^[A-Za-z0-9]{4,12}$/.test(r)) { try { localStorage.setItem('ref', r.toUpperCase()) } catch { /* ignore */ } }
  }, [params])
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Catalog />} />
        <Route path="products/:id" element={<ProductPage />} />
        <Route path="cart" element={<Cart />} />
        <Route path="checkout" element={<Checkout />} />
        <Route path="login" element={<Login />} />
        <Route path="orders" element={<RequireAuth><Orders /></RequireAuth>} />
        <Route path="policy/:slug" element={<Policy />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<p className="state">404</p>} />
      </Route>
    </Routes>
  )
}
