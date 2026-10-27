import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useL } from '../../lib/i18n'
import { Loading } from '../../components/ui'

export default function AdminLayout() {
  const { profile, ready } = useAuth()
  const L = useL()
  if (!ready || !profile) return <Loading />
  const staff = profile.role === 'staff' || profile.role === 'admin'
  const admin = profile.role === 'admin'
  // UI convenience only: every action is re-checked inside the database.
  if (!staff) return <p className="banner warn">{L('या विभागात प्रवेश नाही.', 'You do not have access to this area.')}</p>
  const items: [string, string, boolean][] = [
    ['/admin', L('सारांश', 'Overview'), true], ['/admin/orders', L('ऑर्डर्स', 'Orders'), true], ['/admin/products', L('उत्पादने व स्टॉक', 'Products & stock'), true],
    ['/admin/distributors', L('वितरक', 'Distributors'), true], ['/admin/returns', L('रिटर्न/रिफंड', 'Returns'), admin],
    ['/admin/commissions', L('कमिशन', 'Commissions'), admin], ['/admin/payouts', L('पेआउट', 'Payouts'), admin],
    ['/admin/complaints', L('तक्रारी', 'Complaints'), true], ['/admin/settings', L('सेटिंग्ज', 'Settings'), admin],
    ['/admin/users', L('वापरकर्ते', 'Users'), admin], ['/admin/audit', L('ऑडिट', 'Audit'), admin],
  ]
  return (
    <>
      <nav className="subnav" aria-label="admin">
        {items.filter((i) => i[2]).map(([to, label]) => <NavLink key={to} to={to} end={to === '/admin'}>{label}</NavLink>)}
      </nav>
      <Outlet />
    </>
  )
}
