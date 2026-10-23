import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && key && !url.includes('YOUR-PROJECT'))
// Only the public anon key is ever used in the browser. Access is limited by RLS in the database.
export const supabase = isConfigured ? createClient(url as string, key as string) : null
export const isProduction = import.meta.env.VITE_APP_MODE === 'production'
