import { describe, it, expect } from 'vitest'
import { estimate, lineTotals } from './pricing'

describe('pricing estimate (mirrors the database function)', () => {
  it('inclusive GST is inside the price', () => {
    expect(lineTotals(105, 2, { gst_rate: 5, inclusive: true })).toEqual({ line: 210, tax: 10, extra: 0 })
  })
  it('exclusive GST is added on top', () => {
    expect(lineTotals(100, 1, { gst_rate: 18, inclusive: false })).toEqual({ line: 100, tax: 18, extra: 18 })
  })
  it('matches the server test: subtotal 310, tax 28, total 328', () => {
    const r = estimate([{ price: 105, qty: 2, cfg: { gst_rate: 5, inclusive: true } }, { price: 100, qty: 1, cfg: { gst_rate: 18, inclusive: false } }], 0, null)
    expect(r).toEqual({ subtotal: 310, tax: 28, delivery: 0, total: 328 })
  })
  it('free delivery above threshold', () => {
    expect(estimate([{ price: 500, qty: 1 }], 50, 400).delivery).toBe(0)
    expect(estimate([{ price: 300, qty: 1 }], 50, 400).delivery).toBe(50)
  })
})
