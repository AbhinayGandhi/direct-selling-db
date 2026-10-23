import { useParams } from 'react-router-dom'
import { useI18n, type Key } from '../lib/i18n'
import { POLICIES, type Slug } from '../lib/policies'
import { isProduction } from '../lib/supabase'

const TITLE: Record<Slug, Key> = { shipping: 'shipping', returns: 'returns', privacy: 'privacy', terms: 'terms', grievance: 'grievance', 'distributor-terms': 'distTerms' }

export default function Policy() {
  const { slug = '' } = useParams()
  const { t, lang } = useI18n()
  if (!(slug in POLICIES)) return <p className="state">{t('policyUnavailable')}</p>
  const s = slug as Slug
  const approved = import.meta.env.VITE_POLICIES_APPROVED === 'true'
  return (
    <article className="prose">
      <h1>{t(TITLE[s])}</h1>
      {isProduction && !approved ? <p className="state">{t('policyUnavailable')}</p> : (
        <>
          {!approved && <p className="banner warn" role="note">{t('draftBanner')}</p>}
          <ul>{POLICIES[s][lang].map((line) => <li key={line}>{line}</li>)}</ul>
        </>)}
    </article>
  )
}
