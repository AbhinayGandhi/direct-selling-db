import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

interface Profile { role: string; account_status: string; full_name: string | null }
const Ctx = createContext<{ session: Session | null; profile: Profile | null; ready: boolean; signOut: () => Promise<void> }>(
  { session: null, profile: null, ready: false, signOut: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(!supabase)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true) })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!supabase || !session) { setProfile(null); return }
    supabase.from('profiles').select('role,account_status,full_name').eq('id', session.user.id).maybeSingle()
      .then(({ data }) => setProfile((data as Profile | null) ?? null))
  }, [session])

  const signOut = async () => { await supabase?.auth.signOut() }
  return <Ctx.Provider value={{ session, profile, ready, signOut }}>{children}</Ctx.Provider>
}
export const useAuth = () => useContext(Ctx)
