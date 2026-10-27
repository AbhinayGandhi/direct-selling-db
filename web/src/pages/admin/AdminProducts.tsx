import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAsync, type Category } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction, num } from '../../lib/act'
import { useAuth } from '../../lib/auth'
import { inr } from '../../lib/pricing'
import { ErrorBox, Field, Loading } from '../../components/ui'

interface P { id: string; sku: string; product_name: string; description: string | null; mrp: number; selling_price: number; purchase_cost: number
  applicable_tax_configuration: { gst_rate?: number; inclusive?: boolean } | null; image_path: string | null; stock_tracking_enabled: boolean
  stock_quantity: number; low_stock_threshold: number; active: boolean; category_id: string | null; supplier_id: string | null }
interface S { id: string; supplier_name: string }
const empty = { id: '', sku: '', product_name: '', description: '', mrp: '', selling_price: '', purchase_cost: '', gst: '0', inclusive: true, image: '', tracking: true, low: '5', active: false, category: '', supplier: '' }

async function load() {
  if (!supabase) throw new Error('x')
  const [p, c, s] = await Promise.all([supabase.from('products').select('*').order('product_name'), supabase.from('categories').select('id,category_name').order('category_name'), supabase.from('suppliers').select('id,supplier_name').order('supplier_name')])
  if (p.error || c.error || s.error) throw new Error('x')
  return { products: (p.data ?? []) as P[], cats: (c.data ?? []) as Category[], sups: (s.data ?? []) as S[] }
}

export default function AdminProducts() {
  const L = useL(); const { profile } = useAuth(); const admin = profile?.role === 'admin'
  const d = useAsync(load, [])
  const [f, setF] = useState(empty)
  const [formErr, setFormErr] = useState<string | null>(null)
  const a = useAction(() => { d.retry(); setF(empty) })
  const set = (k: keyof typeof empty) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  function edit(p: P) {
    setF({ id: p.id, sku: p.sku, product_name: p.product_name, description: p.description ?? '', mrp: String(p.mrp), selling_price: String(p.selling_price), purchase_cost: String(p.purchase_cost),
      gst: String(p.applicable_tax_configuration?.gst_rate ?? 0), inclusive: p.applicable_tax_configuration?.inclusive ?? true, image: p.image_path ?? '', tracking: p.stock_tracking_enabled,
      low: String(p.low_stock_threshold), active: p.active, category: p.category_id ?? '', supplier: p.supplier_id ?? '' })
    window.scrollTo({ top: 0 })
  }
  function save(e: FormEvent) {
    e.preventDefault(); setFormErr(null)
    const mrp = num(f.mrp), price = num(f.selling_price), cost = num(f.purchase_cost || '0'), gst = num(f.gst || '0'), low = num(f.low || '0')
    if (mrp === null || price === null || cost === null || gst === null || low === null || price > mrp || gst < 0 || gst > 28) { setFormErr(L('किंमती तपासा (विक्री किंमत MRP पेक्षा जास्त नको; GST 0 ते 28).', 'Check prices (selling price must not exceed MRP; GST 0 to 28).')); return }
    const row = { sku: f.sku.trim(), product_name: f.product_name.trim(), description: f.description || null, mrp, selling_price: price, purchase_cost: cost,
      applicable_tax_configuration: { gst_rate: gst, inclusive: f.inclusive }, image_path: f.image.trim() || null, stock_tracking_enabled: f.tracking, low_stock_threshold: low,
      active: f.active, category_id: f.category || null, supplier_id: f.supplier || null }
    a.run(async () => {
      if (!supabase) return 'x'
      const r = f.id ? await supabase.from('products').update(row).eq('id', f.id) : await supabase.from('products').insert(row)
      return r.error ? r.error.message : null
    })
  }
  function receive(p: P) {
    const q = window.prompt(L(`"${p.product_name}" साठी आलेली संख्या:`, `Quantity received for "${p.product_name}":`)); if (!q) return
    const inv = window.prompt(L('पुरवठादार बिल क्रमांक:', 'Supplier invoice reference:')) ?? ''
    a.run(() => rpc('receive_stock', { p_product_id: p.id, p_quantity: Number(q), p_invoice_ref: inv, p_batch: null, p_expiry: null, p_unit_cost: null }))
  }
  function addNamed(table: 'categories' | 'suppliers', label: string) {
    const n = window.prompt(label); if (!n?.trim()) return
    a.run(async () => {
      if (!supabase) return 'x'
      const r = table === 'categories' ? await supabase.from('categories').insert({ category_name: n.trim() }) : await supabase.from('suppliers').insert({ supplier_name: n.trim() })
      return r.error ? r.error.message : null
    })
  }
  if (d.loading) return <Loading />
  if (d.error || !d.data) return <ErrorBox onRetry={d.retry} />
  return (
    <>
      <h1>{L('उत्पादने व स्टॉक', 'Products & stock')}</h1>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      {admin && (
        <form className="form wide" onSubmit={save}>
          <h2>{f.id ? L('उत्पादन संपादन', 'Edit product') : L('नवीन उत्पादन', 'New product')}</h2>
          <Field label="SKU"><input required value={f.sku} onChange={set('sku')} /></Field>
          <Field label={L('नाव', 'Name')}><input required value={f.product_name} onChange={set('product_name')} /></Field>
          <Field label={L('वर्णन', 'Description')}><textarea rows={2} value={f.description} onChange={set('description')} /></Field>
          <Field label="MRP ₹"><input required inputMode="decimal" value={f.mrp} onChange={set('mrp')} /></Field>
          <Field label={L('विक्री किंमत ₹', 'Selling price ₹')}><input required inputMode="decimal" value={f.selling_price} onChange={set('selling_price')} /></Field>
          <Field label={L('खरेदी किंमत ₹ (ग्राहकाला दिसत नाही)', 'Purchase cost ₹ (hidden from customers)')}><input inputMode="decimal" value={f.purchase_cost} onChange={set('purchase_cost')} /></Field>
          <Field label="GST %"><input inputMode="decimal" value={f.gst} onChange={set('gst')} /></Field>
          <label className="check"><input type="checkbox" checked={f.inclusive} onChange={(e) => setF({ ...f, inclusive: e.target.checked })} /> {L('GST किमतीत समाविष्ट आहे', 'GST is included in the price')}</label>
          <Field label={L('प्रतिमा लिंक (https://)', 'Image link (https://)')}><input value={f.image} onChange={set('image')} /></Field>
          <Field label={L('प्रकार', 'Category')}><select value={f.category} onChange={set('category')}><option value="">—</option>{d.data.cats.map((c) => <option key={c.id} value={c.id}>{c.category_name}</option>)}</select></Field>
          <Field label={L('पुरवठादार', 'Supplier')}><select value={f.supplier} onChange={set('supplier')}><option value="">—</option>{d.data.sups.map((c) => <option key={c.id} value={c.id}>{c.supplier_name}</option>)}</select></Field>
          <Field label={L('कमी स्टॉक सूचना पातळी', 'Low-stock level')}><input inputMode="numeric" value={f.low} onChange={set('low')} /></Field>
          <label className="check"><input type="checkbox" checked={f.tracking} onChange={(e) => setF({ ...f, tracking: e.target.checked })} /> {L('स्टॉक मोजा', 'Track stock')}</label>
          <label className="check"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {L('दुकानात दाखवा (मंजूर)', 'Show in store (approved)')}</label>
          {formErr && <p className="banner warn" role="alert">{formErr}</p>}
          <button className="btn primary block" disabled={a.busy}>{L('जतन करा', 'Save')}</button>
          {f.id && <button type="button" className="link" onClick={() => setF(empty)}>{L('रद्द', 'Cancel edit')}</button>}
          <div className="row">
            <button type="button" className="btn" onClick={() => addNamed('categories', L('नवीन प्रकाराचे नाव:', 'New category name:'))}>+ {L('प्रकार', 'Category')}</button>
            <button type="button" className="btn" onClick={() => addNamed('suppliers', L('पुरवठादाराचे नाव:', 'Supplier name:'))}>+ {L('पुरवठादार', 'Supplier')}</button>
          </div>
        </form>)}
      <ul className="orders">{d.data.products.map((p) => (
        <li key={p.id} className="card">
          <h3>{p.product_name} <span className="muted">{p.sku}</span></h3>
          <p>{inr(p.selling_price)} / MRP {inr(p.mrp)} · {L('खरेदी', 'cost')} {inr(p.purchase_cost)} · GST {p.applicable_tax_configuration?.gst_rate ?? 0}%</p>
          <p className={p.stock_tracking_enabled && p.stock_quantity <= p.low_stock_threshold ? 'bad' : ''}>{L('स्टॉक', 'Stock')}: {p.stock_tracking_enabled ? p.stock_quantity : '—'} · {p.active ? L('दुकानात दिसते', 'Visible') : L('लपलेले', 'Hidden')}</p>
          <div className="row"><button className="btn" onClick={() => receive(p)}>{L('स्टॉक आला', 'Receive stock')}</button>{admin && <button className="btn" onClick={() => edit(p)}>{L('संपादन', 'Edit')}</button>}</div>
        </li>))}</ul>
    </>
  )
}
