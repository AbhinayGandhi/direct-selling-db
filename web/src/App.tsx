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
import Distributor from './pages/Distributor'
import Support from './pages/Support'
import AdminLayout from './pages/admin/AdminLayout'
import Overview from './pages/admin/Overview'
import AdminOrders from './pages/admin/AdminOrders'
import AdminProducts from './pages/admin/AdminProducts'
import AdminDistributors from './pages/admin/AdminDistributors'
import AdminReturns from './pages/admin/AdminReturns'
import AdminCommissions from './pages/admin/AdminCommissions'
import AdminPayouts from './pages/admin/AdminPayouts'
import AdminComplaints from './pages/admin/AdminComplaints'
import AdminSettings from './pages/admin/AdminSettings'
import AdminUsers from './pages/admin/AdminUsers'
import AdminAudit from './pages/admin/AdminAudit'

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
        <Route path="distributor" element={<RequireAuth><Distributor /></RequireAuth>} />
        <Route path="support" element={<RequireAuth><Support /></RequireAuth>} />
        <Route path="admin" element={<RequireAuth><AdminLayout /></RequireAuth>}>
          <Route index element={<Overview />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="distributors" element={<AdminDistributors />} />
          <Route path="returns" element={<AdminReturns />} />
          <Route path="commissions" element={<AdminCommissions />} />
          <Route path="payouts" element={<AdminPayouts />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="audit" element={<AdminAudit />} />
        </Route>
        <Route path="policy/:slug" element={<Policy />} />
        <Route path="contact" element={<Contact />} />
        <Route path="*" element={<p className="state">404</p>} />
      </Route>
    </Routes>
  )
}
