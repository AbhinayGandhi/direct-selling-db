import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { when } from '../../lib/act'
import { ErrorBox, Loading } from '../../components/ui'

interface A { id: string; action: string; entity_type: string; actor_id: string | null; created_at: string; safe_metadata: Record<string, unknown> }
async function load(): Promise<A[]> {
  if (!supabase) throw new Error('x')
  const { data, error } = await supabase.from('audit_logs').select('id,action,entity_type,actor_id,created_at,safe_metadata').order('created_at', { ascending: false }).limit(100)
  if (error) throw error
  return (data ?? []) as A[]
}
export default function AdminAudit() {
  const L = useL(); const list = useAsync(load, [])
  if (list.loading) return <Loading />
  if (list.error) return <ErrorBox onRetry={list.retry} />
  return (
    <>
      <h1>{L('ऑडिट नोंदी (शेवटच्या 100)', 'Audit log (latest 100)')}</h1>
      <div className="scroll"><table><thead><tr><th>{L('वेळ', 'Time')}</th><th>{L('कृती', 'Action')}</th><th>{L('प्रकार', 'Type')}</th><th>{L('करणारा', 'By')}</th></tr></thead>
        <tbody>{(list.data ?? []).map((r) => <tr key={r.id}><td>{when(r.created_at)}</td><td>{r.action}</td><td>{r.entity_type}</td><td>{r.actor_id?.slice(0, 8)}</td></tr>)}</tbody></table></div>
    </>
  )
}
