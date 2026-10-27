import { useState } from 'react'
import { supabase } from './supabase'

// Calls a database function. The database decides whether the caller is allowed; errors come back as text.
export async function rpc(name: string, args: Record<string, unknown>): Promise<string | null> {
  if (!supabase) return 'not configured'
  const { error } = await supabase.rpc(name, args)
  return error ? error.message : null
}
export function useAction(done: () => void) {
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const run = async (fn: () => Promise<string | null>) => {
    setBusy(true); setMsg(null)
    const e = await fn().catch((x: Error) => x.message)
    setBusy(false)
    if (e) setMsg(e); else done()
  }
  return { msg, busy, run }
}
export const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? null : Number(s))
export const when = (s: string | null) => (s ? new Date(s).toLocaleString('en-IN') : '')
