import type { ReactNode } from 'react'
import { useI18n } from '../lib/i18n'

export function Loading() { const { t } = useI18n(); return <p className="state" role="status">{t('loading')}</p> }
export function ErrorBox({ onRetry }: { onRetry: () => void }) {
  const { t } = useI18n()
  return <div className="state error" role="alert"><p>{t('loadError')}</p><button className="btn" onClick={onRetry}>{t('retry')}</button></div>
}
export function Empty({ children }: { children: ReactNode }) { return <p className="state">{children}</p> }
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="field"><span>{label}</span>{children}</label>
}
