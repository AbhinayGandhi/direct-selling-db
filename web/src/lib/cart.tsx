import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface CartLine { productId: string; qty: number }
const KEY = 'cart.v1'
const Ctx = createContext<{ lines: CartLine[]; count: number; add: (id: string, n?: number) => void; setQty: (id: string, n: number) => void; remove: (id: string) => void; clear: () => void }>(
  { lines: [], count: 0, add: () => {}, setQty: () => {}, remove: () => {}, clear: () => {} })

const load = (): CartLine[] => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v.filter((l) => l && typeof l.productId === 'string' && l.qty > 0) : [] } catch { return [] }
}

// The cart stores ONLY product ids and quantities. Prices are always re-read from the database.
export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(load)
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(lines)) } catch { /* storage may be blocked */ } }, [lines])
  const clamp = (n: number) => Math.max(1, Math.min(100, Math.floor(n) || 1))
  const add = (id: string, n = 1) => setLines((ls) => ls.some((l) => l.productId === id)
    ? ls.map((l) => (l.productId === id ? { ...l, qty: clamp(l.qty + n) } : l)) : [...ls, { productId: id, qty: clamp(n) }])
  const setQty = (id: string, n: number) => setLines((ls) => ls.map((l) => (l.productId === id ? { ...l, qty: clamp(n) } : l)))
  const remove = (id: string) => setLines((ls) => ls.filter((l) => l.productId !== id))
  const clear = () => setLines([])
  return <Ctx.Provider value={{ lines, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear }}>{children}</Ctx.Provider>
}
export const useCart = () => useContext(Ctx)
