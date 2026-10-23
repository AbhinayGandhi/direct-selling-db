// DISPLAY ESTIMATE ONLY. The database function create_order recalculates every price, tax and
// delivery charge on the server; the browser never decides what the customer pays.
export interface TaxCfg { gst_rate?: number; inclusive?: boolean }
export const round2 = (x: number) => Math.round((x + Number.EPSILON) * 100) / 100

export function lineTotals(price: number, qty: number, cfg: TaxCfg | null | undefined) {
  const rate = cfg?.gst_rate ?? 0
  const inclusive = cfg?.inclusive ?? true
  const line = round2(price * qty)
  const tax = inclusive ? round2(line - line / (1 + rate / 100)) : round2((line * rate) / 100)
  return { line, tax, extra: inclusive ? 0 : tax }
}

export interface EstItem { price: number; qty: number; cfg?: TaxCfg | null }
export function estimate(items: EstItem[], deliveryCharge: number, freeAbove: number | null) {
  let subtotal = 0, tax = 0, extra = 0
  for (const i of items) { const t = lineTotals(i.price, i.qty, i.cfg); subtotal += t.line; tax += t.tax; extra += t.extra }
  subtotal = round2(subtotal)
  const delivery = freeAbove !== null && subtotal >= freeAbove ? 0 : deliveryCharge
  return { subtotal, tax: round2(tax), delivery, total: round2(subtotal + extra + delivery) }
}

export const inr = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
