import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import type { TaxCfg } from './pricing'

export interface Product {
  id: string; sku: string; product_name: string; description: string | null; category_id: string | null
  mrp: number; selling_price: number; applicable_tax_configuration: TaxCfg | null; image_path: string | null; in_stock: boolean
}
export interface Category { id: string; category_name: string }
export interface Company {
  legal_business_name: string | null; registered_address: string | null; support_email: string | null; support_phone: string | null
  gstin: string | null; grievance_officer_details: string | null; delivery_charge: number; free_delivery_above: number | null; return_window_days: number
}

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: boolean }>({ data: null, loading: true, error: false })
  const [n, setN] = useState(0)
  useEffect(() => {
    let live = true
    setState((s) => ({ ...s, loading: true, error: false }))
    fn().then((data) => live && setState({ data, loading: false, error: false }))
      .catch(() => live && setState({ data: null, loading: false, error: true }))
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, n])
  const retry = useCallback(() => setN((x) => x + 1), [])
  return { ...state, retry }
}

export const PAGE_SIZE = 12
const clean = (s: string) => s.replace(/[%,()*\\]/g, ' ').trim().slice(0, 60)

export async function fetchProducts(page: number, q: string, category: string): Promise<{ rows: Product[]; more: boolean }> {
  if (!supabase) throw new Error('not configured')
  let query = supabase.from('public_products').select('*').order('product_name').range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
  const term = clean(q)
  if (term) query = query.ilike('product_name', `%${term}%`)
  if (category) query = query.eq('category_id', category)
  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as Product[]
  return { rows: rows.slice(0, PAGE_SIZE), more: rows.length > PAGE_SIZE }
}
export async function fetchProduct(id: string): Promise<Product | null> {
  if (!supabase) throw new Error('not configured')
  const { data, error } = await supabase.from('public_products').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data as Product | null
}
export async function fetchProductsByIds(ids: string[]): Promise<Product[]> {
  if (!supabase || ids.length === 0) return []
  const { data, error } = await supabase.from('public_products').select('*').in('id', ids)
  if (error) throw error
  return (data ?? []) as Product[]
}
export async function fetchCategories(): Promise<Category[]> {
  if (!supabase) throw new Error('not configured')
  const { data, error } = await supabase.from('categories').select('id,category_name').order('category_name')
  if (error) throw error
  return (data ?? []) as Category[]
}
export async function fetchCompany(): Promise<Company | null> {
  if (!supabase) return null
  const { data, error } = await supabase.from('public_company_info').select('*').maybeSingle()
  if (error) throw error
  return data as Company | null
}
export const imageUrl = (p: string | null) => (p && /^https:\/\//.test(p) ? p : null)
