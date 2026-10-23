import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useI18n } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import { Field } from '../components/ui'

export default function Login() {
  const { t } = useI18n()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as { from?: string } | null)?.from || '/'
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [f, setF] = useState({ email: '', password: '', name: '', phone: '' })
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setBusy(true); setMsg(null)
    if (mode === 'in') {
      const { error } = await supabase.auth.signInWithPassword({ email: f.email, password: f.password })
      if (error) setMsg({ kind: 'err', text: error.message }); else nav(from, { replace: true })
    } else {
      const { data, error } = await supabase.auth.signUp({ email: f.email, password: f.password, options: { data: { full_name: f.name, phone: f.phone } } })
      if (error) setMsg({ kind: 'err', text: error.message })
      else if (data.session) nav(from, { replace: true })
      else setMsg({ kind: 'ok', text: t('checkEmail') })
    }
    setBusy(false)
  }
  async function reset() {
    if (!supabase || !f.email) return
    const { error } = await supabase.auth.resetPasswordForEmail(f.email, { redirectTo: window.location.origin + '/login' })
    setMsg(error ? { kind: 'err', text: error.message } : { kind: 'ok', text: t('resetSent') })
  }
  return (
    <form className="form" onSubmit={submit}>
      <h1>{mode === 'in' ? t('signin') : t('signup')}</h1>
      {mode === 'up' && <>
        <Field label={t('fullName')}><input required autoComplete="name" value={f.name} onChange={set('name')} /></Field>
        <Field label={t('phone')}><input required inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} /></Field>
      </>}
      <Field label={t('email')}><input required type="email" autoComplete="email" value={f.email} onChange={set('email')} /></Field>
      <Field label={t('password')}><input required type="password" minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} value={f.password} onChange={set('password')} /></Field>
      {msg && <p className={msg.kind === 'ok' ? 'banner ok' : 'banner warn'} role="alert">{msg.text}</p>}
      <button className="btn primary block" disabled={busy || !supabase}>{mode === 'in' ? t('signin') : t('signup')}</button>
      {mode === 'in' && <button type="button" className="link" onClick={reset}>{t('forgot')}</button>}
      <p>{mode === 'in' ? t('noAccount') : t('haveAccount')}{' '}
        <button type="button" className="link" onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(null) }}>{mode === 'in' ? t('signup') : t('signin')}</button></p>
    </form>
  )
}
