import { useI18n } from '../lib/i18n'
import { fetchCompany, useAsync } from '../lib/data'
import { ErrorBox, Loading } from '../components/ui'

export default function Contact() {
  const { t } = useI18n()
  const c = useAsync(fetchCompany, [])
  if (c.loading) return <Loading />
  if (c.error) return <ErrorBox onRetry={c.retry} />
  const d = c.data
  // Nothing is invented: only what the owner has entered in company_settings is shown.
  if (!d || !d.legal_business_name) return <p className="state">{t('companyMissing')}</p>
  return (
    <article className="prose">
      <h1>{t('contact')}</h1>
      <p><strong>{d.legal_business_name}</strong></p>
      {d.registered_address && <p>{d.registered_address}</p>}
      {d.support_phone && <p><a href={`tel:${d.support_phone}`}>{d.support_phone}</a></p>}
      {d.support_email && <p><a href={`mailto:${d.support_email}`}>{d.support_email}</a></p>}
      {d.gstin && <p>GSTIN: {d.gstin}</p>}
      {d.grievance_officer_details && <p>{t('grievance')}: {d.grievance_officer_details}</p>}
    </article>
  )
}
