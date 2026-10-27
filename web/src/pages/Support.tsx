import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAsync } from '../lib/data'
import { useL } from '../lib/i18n'
import { rpc, useAction, when } from '../lib/act'
import { Empty, ErrorBox, Field, Loading } from '../components/ui'

interface C { id: string; complaint_number: string; subject: string; status: string; resolution_notes: string | null; created_at: string }
interface O { id: string; order_number: string }
async function load() {
  if (!supabase) throw new Error('x')
  const [c, o] = await Promise.all([supabase.from('complaints').select('id,complaint_number,subject,status,resolution_notes,created_at').order('created_at', { ascending: false }),
    supabase.from('orders').select('id,order_number').order('created_at', { ascending: false }).limit(50)])
  if (c.error || o.error) throw new Error('x')
  return { c: (c.data ?? []) as C[], o: (o.data ?? []) as O[] }
}
export default function Support() {
  const L = useL(); const d = useAsync(load, []); const [f, setF] = useState({ order: '', subject: '', text: '' })
  const a = useAction(() => { setF({ order: '', subject: '', text: '' }); d.retry() })
  if (d.loading) return <Loading />
  if (d.error || !d.data) return <ErrorBox onRetry={d.retry} />
  return (
    <>
      <form className="form" onSubmit={(e: FormEvent) => { e.preventDefault(); a.run(() => rpc('create_complaint', { p_order_id: f.order || null, p_subject: f.subject, p_description: f.text })) }}>
        <h1>{L('तक्रार / मदत', 'Complaint / support')}</h1>
        <Field label={L('ऑर्डर (पर्यायी)', 'Order (optional)')}><select value={f.order} onChange={(e) => setF({ ...f, order: e.target.value })}><option value="">—</option>{d.data.o.map((o) => <option key={o.id} value={o.id}>{o.order_number}</option>)}</select></Field>
        <Field label={L('विषय', 'Subject')}><input required maxLength={200} value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label={L('तपशील', 'Details')}><textarea required rows={4} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></Field>
        {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
        <button className="btn primary block" disabled={a.busy}>{L('तक्रार नोंदवा', 'Submit')}</button>
      </form>
      <h2>{L('माझ्या तक्रारी', 'My complaints')}</h2>
      {!d.data.c.length ? <Empty>{L('तक्रारी नाहीत.', 'No complaints.')}</Empty> : <ul className="orders">{d.data.c.map((c) => (
        <li key={c.id} className="card"><h3>{c.complaint_number} · {c.subject}</h3><p>{c.status}{c.resolution_notes && ` — ${c.resolution_notes}`} <span className="muted">{when(c.created_at)}</span></p></li>))}</ul>}
    </>
  )
}
