import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction, when } from '../../lib/act'
import { Empty, ErrorBox, Loading } from '../../components/ui'

interface C { id: string; complaint_number: string; subject: string; description: string; status: string; resolution_notes: string | null; created_at: string; orders: { order_number: string } | null }
async function load(): Promise<C[]> {
  if (!supabase) throw new Error('x')
  const { data, error } = await supabase.from('complaints').select('id,complaint_number,subject,description,status,resolution_notes,created_at,orders(order_number)').order('created_at', { ascending: false }).limit(50)
  if (error) throw error
  return (data ?? []) as unknown as C[]
}
export default function AdminComplaints() {
  const L = useL(); const list = useAsync(load, []); const a = useAction(list.retry)
  function setStatus(c: C, status: string) {
    const notes = status === 'resolved' || status === 'closed' ? window.prompt(L('निवारणाची नोंद:', 'Resolution notes:'), c.resolution_notes ?? '') : c.resolution_notes
    if (notes === null) return
    a.run(() => rpc('update_complaint', { p_id: c.id, p_status: status, p_notes: notes, p_assigned_to: null }))
  }
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox onRetry={list.retry} />
  return (
    <>
      <h1>{L('तक्रारी', 'Complaints')}</h1>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      {!list.data?.length ? <Empty>{L('तक्रारी नाहीत.', 'No complaints.')}</Empty> : <ul className="orders">{list.data.map((c) => (
        <li key={c.id} className="card">
          <h3>{c.complaint_number} · {c.subject} <span className="muted">{when(c.created_at)}</span></h3>
          <p>{c.description}</p>{c.orders && <p className="muted">{c.orders.order_number}</p>}
          <p>{c.status}{c.resolution_notes && ` — ${c.resolution_notes}`}</p>
          <div className="row">{['in_progress', 'resolved', 'closed'].filter((s) => s !== c.status).map((s) => <button key={s} className="btn" disabled={a.busy} onClick={() => setStatus(c, s)}>→ {s}</button>)}</div>
        </li>))}</ul>}
    </>
  )
}
