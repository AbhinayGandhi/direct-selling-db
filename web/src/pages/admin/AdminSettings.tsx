import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { useAsync } from '../../lib/data'
import { useL } from '../../lib/i18n'
import { useAction, num } from '../../lib/act'
import { ErrorBox, Field, Loading } from '../../components/ui'

interface S { legal_business_name: string | null; registered_address: string | null; support_email: string | null; support_phone: string | null; gstin: string | null
  grievance_officer_details: string | null; delivery_charge: number; free_delivery_above: number | null; return_window_days: number
  live_sales_enabled: boolean; live_commission_enabled: boolean; compliance_review_status: string }
async function load(): Promise<S> {
  if (!supabase) throw new Error('x')
  const { data, error } = await supabase.from('company_settings').select('*').maybeSingle()
  if (error || !data) throw new Error('x')
  return data as S
}
export default function AdminSettings() {
  const L = useL(); const d = useAsync(load, [])
  const [f, setF] = useState<Record<string, string>>({}); const [sales, setSales] = useState(false); const [comm, setComm] = useState(false); const [review, setReview] = useState('not_started')
  const [ok, setOk] = useState(false)
  const a = useAction(() => { setOk(true); d.retry() })
  useEffect(() => {
    const s = d.data; if (!s) return
    setF({ legal_business_name: s.legal_business_name ?? '', registered_address: s.registered_address ?? '', support_email: s.support_email ?? '', support_phone: s.support_phone ?? '', gstin: s.gstin ?? '',
      grievance_officer_details: s.grievance_officer_details ?? '', delivery_charge: String(s.delivery_charge), free_delivery_above: s.free_delivery_above === null ? '' : String(s.free_delivery_above), return_window_days: String(s.return_window_days) })
    setSales(s.live_sales_enabled); setComm(s.live_commission_enabled); setReview(s.compliance_review_status)
  }, [d.data])
  const set = (k: string) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  function save(e: FormEvent) {
    e.preventDefault(); setOk(false)
    const t = (k: string) => (f[k] ?? '').trim() || null
    const dc = num(f.delivery_charge || '0'), rw = num(f.return_window_days || '0'), fd = f.free_delivery_above?.trim() ? num(f.free_delivery_above) : null
    if (dc === null || rw === null || (f.free_delivery_above?.trim() && fd === null)) { window.alert(L('आकडे तपासा.', 'Check the numbers.')); return }
    if (sales && !d.data?.live_sales_enabled && !(f.legal_business_name ?? '').trim()) { window.alert(L('विक्री चालू करण्यापूर्वी कंपनीचे खरे नाव भरा.', 'Enter the real business name before switching sales on.')); return }
    if (sales && !d.data?.live_sales_enabled && !window.confirm(L('ऑर्डर घेणे चालू करायचे?', 'Switch order-taking on?'))) return
    a.run(async () => {
      if (!supabase) return 'x'
      const r = await supabase.from('company_settings').update({ legal_business_name: t('legal_business_name'), registered_address: t('registered_address'), support_email: t('support_email'), support_phone: t('support_phone'),
        gstin: t('gstin'), grievance_officer_details: t('grievance_officer_details'), delivery_charge: dc, free_delivery_above: fd, return_window_days: rw,
        live_sales_enabled: sales, live_commission_enabled: comm, compliance_review_status: review }).eq('id', true)
      return r.error ? (r.error.message.includes('commission_requires_review') ? L('कमिशन चालू करण्यासाठी आधी "पुनरावलोकन मंजूर" निवडणे आवश्यक आहे.', 'Commission can only be switched on when the review status is "approved".') : r.error.message) : null
    })
  }
  if (d.loading) return <Loading />
  if (d.error) return <ErrorBox onRetry={d.retry} />
  return (
    <form className="form wide" onSubmit={save}>
      <h1>{L('सेटिंग्ज', 'Settings')}</h1>
      <p className="muted">{L('येथे फक्त खरी माहिती भरा. रिकामे सोडले तर साइटवर काहीही बनावट दिसत नाही.', 'Enter real details only. If left empty, nothing invented is shown on the site.')}</p>
      <Field label={L('कायदेशीर व्यवसायाचे नाव', 'Legal business name')}><input value={f.legal_business_name ?? ''} onChange={set('legal_business_name')} /></Field>
      <Field label={L('नोंदणीकृत पत्ता', 'Registered address')}><textarea rows={2} value={f.registered_address ?? ''} onChange={set('registered_address')} /></Field>
      <Field label={L('सपोर्ट ईमेल', 'Support email')}><input type="email" value={f.support_email ?? ''} onChange={set('support_email')} /></Field>
      <Field label={L('सपोर्ट फोन', 'Support phone')}><input value={f.support_phone ?? ''} onChange={set('support_phone')} /></Field>
      <Field label="GSTIN"><input value={f.gstin ?? ''} onChange={set('gstin')} /></Field>
      <Field label={L('तक्रार निवारण अधिकारी (नाव, संपर्क)', 'Grievance officer (name, contact)')}><textarea rows={2} value={f.grievance_officer_details ?? ''} onChange={set('grievance_officer_details')} /></Field>
      <Field label={L('डिलिव्हरी शुल्क ₹', 'Delivery charge ₹')}><input inputMode="decimal" value={f.delivery_charge ?? ''} onChange={set('delivery_charge')} /></Field>
      <Field label={L('इतक्या ₹ वर डिलिव्हरी मोफत (रिकामे = नेहमी शुल्क)', 'Free delivery above ₹ (empty = never)')}><input inputMode="decimal" value={f.free_delivery_above ?? ''} onChange={set('free_delivery_above')} /></Field>
      <Field label={L('रिटर्न कालावधी (दिवस)', 'Return window (days)')}><input inputMode="numeric" value={f.return_window_days ?? ''} onChange={set('return_window_days')} /></Field>
      <h2>{L('चालू/बंद', 'Switches')}</h2>
      <label className="check"><input type="checkbox" checked={sales} onChange={(e) => setSales(e.target.checked)} /> {L('ऑर्डर घेणे चालू', 'Order-taking ON')}</label>
      <Field label={L('कायदेशीर/अनुपालन पुनरावलोकन स्थिती (फक्त पात्र व्यक्तीने पुनरावलोकन केल्यावर "मंजूर" निवडा)', 'Compliance review status (choose "approved" only after a qualified reviewer has signed off)')}>
        <select value={review} onChange={(e) => setReview(e.target.value)}>{['not_started', 'in_review', 'approved', 'rejected'].map((s) => <option key={s}>{s}</option>)}</select></Field>
      <label className="check"><input type="checkbox" checked={comm} onChange={(e) => setComm(e.target.checked)} /> {L('कमिशन चालू (थेट विक्रीवर टक्केवारी)', 'Commission ON (direct sales percentage)')}</label>
      {a.msg && <p className="banner warn" role="alert">{a.msg}</p>}{ok && !a.msg && <p className="banner ok" role="status">{L('जतन झाले.', 'Saved.')}</p>}
      <button className="btn primary block" disabled={a.busy}>{L('जतन करा', 'Save')}</button>
    </form>
  )
}
