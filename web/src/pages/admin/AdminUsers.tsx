import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction } from '../../lib/act'
import { ErrorBox, Loading } from '../../components/ui'

interface U { id: string; full_name: string | null; phone: string | null; role: string; account_status: string }
async function load(): Promise<U[]> {
  if (!supabase) throw new Error('x')
  const { data, error } = await supabase.from('profiles').select('id,full_name,phone,role,account_status').order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []) as U[]
}
export default function AdminUsers() {
  const L = useL(); const list = useAsync(load, []); const a = useAction(list.retry)
  function change(u: U, role: string, status: string) {
    if (!window.confirm(L(`${u.full_name ?? u.id}: भूमिका ${role}, स्थिती ${status}?`, `${u.full_name ?? u.id}: role ${role}, status ${status}?`))) return
    a.run(() => rpc('admin_set_role', { p_profile_id: u.id, p_role: role, p_status: status }))
  }
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox onRetry={list.retry} />
  return (
    <>
      <h1>{L('वापरकर्ते व भूमिका', 'Users & roles')}</h1>
      <p className="muted">{L('स्वतःची भूमिका बदलता येत नाही. "staff" ला ऑर्डर/स्टॉक/तक्रारी दिसतात; आर्थिक मंजुरी फक्त "admin" ला.', 'You cannot change your own role. "staff" can handle orders/stock/complaints; financial approvals are admin only.')}</p>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      <ul className="orders">{(list.data ?? []).map((u) => (
        <li key={u.id} className="card"><h3>{u.full_name ?? '—'} <span className="muted">{u.phone}</span></h3><p>{u.role} · {u.account_status}</p>
          <div className="row">
            {u.role !== 'staff' && u.role !== 'admin' && <button className="btn" disabled={a.busy} onClick={() => change(u, 'staff', 'active')}>→ staff</button>}
            {u.role !== 'admin' && <button className="btn" disabled={a.busy} onClick={() => change(u, 'admin', 'active')}>→ admin</button>}
            {u.role === 'staff' && <button className="btn" disabled={a.busy} onClick={() => change(u, 'customer', 'active')}>→ customer</button>}
            {u.account_status === 'active' ? <button className="btn" disabled={a.busy} onClick={() => change(u, u.role, 'suspended')}>{L('निलंबित', 'Suspend')}</button> : <button className="btn" disabled={a.busy} onClick={() => change(u, u.role, 'active')}>{L('पुन्हा चालू', 'Reactivate')}</button>}
          </div></li>))}</ul>
    </>
  )
}
