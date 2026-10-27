import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { rpc, useAction, when } from '../../lib/act'
import { useAuth } from '../../lib/auth'
import { Empty, ErrorBox, Loading } from '../../components/ui'

interface D { id: string; distributor_code: string | null; application_status: string; agreement_version: string | null; agreement_accepted_at: string | null; created_at: string; profiles: { full_name: string | null; phone: string | null } | null }
async function load(): Promise<D[]> {
  if (!supabase) throw new Error('x')
  const { data, error } = await supabase.from('distributors').select('id,distributor_code,application_status,agreement_version,agreement_accepted_at,created_at,profiles(full_name,phone)').order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as unknown as D[]
}
export default function AdminDistributors() {
  const L = useL(); const { profile } = useAuth(); const admin = profile?.role === 'admin'
  const list = useAsync(load, []); const a = useAction(list.retry)
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox onRetry={list.retry} />
  return (
    <>
      <h1>{L('वितरक', 'Distributors')}</h1>
      <p className="muted">{L('मंजुरीसाठी कोणतेही शुल्क किंवा स्टॉक खरेदी लागत नाही. मंजुरी केवळ अर्जाच्या पडताळणीवर.', 'No fee or stock purchase is needed. Approval is only a review of the application.')}</p>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}
      {!list.data?.length ? <Empty>{L('अर्ज नाहीत.', 'No applications.')}</Empty> : <ul className="orders">{list.data.map((d) => (
        <li key={d.id} className="card">
          <h3>{d.profiles?.full_name ?? '—'} <span className="muted">{d.profiles?.phone}</span></h3>
          <p>{d.application_status} {d.distributor_code && <strong>· {d.distributor_code}</strong>}</p>
          <p className="muted">{L('करार', 'Agreement')}: {d.agreement_version} · {when(d.agreement_accepted_at)}</p>
          {admin && <div className="row">
            {d.application_status !== 'approved' && <button className="btn primary" disabled={a.busy} onClick={() => a.run(() => rpc('review_distributor', { p_distributor_id: d.id, p_decision: 'approve' }))}>{L('मंजूर', 'Approve')}</button>}
            {d.application_status === 'pending' && <button className="btn" disabled={a.busy} onClick={() => a.run(() => rpc('review_distributor', { p_distributor_id: d.id, p_decision: 'reject' }))}>{L('नाकारा', 'Reject')}</button>}
            {d.application_status === 'approved' && <button className="btn" disabled={a.busy} onClick={() => window.confirm(L('निलंबित करायचे?', 'Suspend?')) && a.run(() => rpc('review_distributor', { p_distributor_id: d.id, p_decision: 'suspend' }))}>{L('निलंबित', 'Suspend')}</button>}
          </div>}
        </li>))}</ul>}
    </>
  )
}
