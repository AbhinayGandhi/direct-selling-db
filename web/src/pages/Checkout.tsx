import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { useCart } from '../lib/cart'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import { fetchCompany, useAsync } from '../lib/data'
import { useCartDetails, Totals } from './Cart'
import { Empty, ErrorBox, Field, Loading } from '../components/ui'

export default function Checkout() {
  const { t } = useI18n()
  const { lines, clear } = useCart()
  const { session } = useAuth()
  const d = useCartDetails()
  const company = useAsync(fetchCompany, [])
  const key = useRef(crypto.randomUUID()) // same key for retries => the server never creates a second order
  const [f, setF] = useState({ name: '', phone: '', address_line: '', city: '', state: 'Maharashtra', pincode: '', method: 'manual_upi', ref: localStorage.getItem('ref') || '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  if (done) return <p className="banner ok" role="status">{t('orderPlaced')} <strong>{done}</strong> <Link to="/orders">{t('orders')}</Link></p>
  if (!session) return <p className="banner warn">{t('needLogin')} <Link to="/login" state={{ from: '/checkout' }}>{t('login')}</Link></p>
  if (lines.length === 0) return <Empty>{t('emptyCart')}</Empty>
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox onRetry={d.retry} />

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase || d.hasInvalid) return
    setErr(null)
    if (!/^[1-9][0-9]{5}$/.test(f.pincode)) { setErr(t('badPincode')); return }
    setBusy(true)
    const { data, error } = await supabase.rpc('create_order', {
      p_items: lines.map((l) => ({ product_id: l.productId, quantity: l.qty })),
      p_shipping: { name: f.name, phone: f.phone, address_line: f.address_line, city: f.city, state: f.state, pincode: f.pincode },
      p_payment_method: f.method, p_idempotency_key: key.current, p_distributor_code: f.ref.trim() || null,
    })
    setBusy(false)
    if (error) { setErr(/not enabled/.test(error.message) ? t('salesOff') : error.message); return }
    const { data: o } = await supabase.from('orders').select('order_number').eq('id', data as string).maybeSingle()
    clear()
    setDone((o as { order_number: string } | null)?.order_number ?? '')
  }

  return (
    <form className="form" onSubmit={submit}>
      <h1>{t('checkout')}</h1>
      {company.data && !company.data.legal_business_name && <p className="banner warn">{t('companyMissing')}</p>}
      <Field label={t('name')}><input required autoComplete="name" value={f.name} onChange={set('name')} /></Field>
      <Field label={t('phone')}><input required inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
      <Field label={t('address')}><textarea required rows={3} autoComplete="street-address" value={f.address_line} onChange={set('address_line')} /></Field>
      <Field label={t('city')}><input required autoComplete="address-level2" value={f.city} onChange={set('city')} /></Field>
      <Field label={t('state')}><input required autoComplete="address-level1" value={f.state} onChange={set('state')} /></Field>
      <Field label={t('pincode')}><input required inputMode="numeric" maxLength={6} autoComplete="postal-code" value={f.pincode} onChange={set('pincode')} /></Field>
      <Field label={t('payment')}>
        <select value={f.method} onChange={set('method')}>
          <option value="manual_upi">{t('payUpi')}</option><option value="bank_transfer">{t('payBank')}</option><option value="cash_on_delivery">{t('payCod')}</option>
        </select>
      </Field>
      <p className="muted">{t('payNote')}</p>
      <Field label={t('refCode')}><input value={f.ref} autoCapitalize="characters" onChange={(e) => { setF({ ...f, ref: e.target.value }) }} /></Field>
      <Totals est={d.est} />
      {err && <p className="banner warn" role="alert">{err}</p>}
      <button className="btn primary block" disabled={busy || d.hasInvalid}>{busy ? t('placing') : t('placeOrder')}</button>
    </form>
  )
}
