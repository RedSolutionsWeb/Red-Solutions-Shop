// Matches the prototype's money() formatter exactly: always 2 decimals,
// thousands separators, "$" prefix. Negative numbers render as "$-12.34",
// not "-$12.34" — there is no special negative handling upstream either.
export function money(n: number | null | undefined): string {
  const v = Math.round((n ?? 0) * 100) / 100
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Cost/margin render as an em dash when unknown — cost 0 is the shop's own
// "never entered" sentinel, never a real $0 cost. Never compute a 100%
// margin from it.
export function costOrUnknown(cost: number | null | undefined): string {
  if (!cost || cost <= 0) return '—'
  return money(cost)
}

export function marginPct(price: number, cost: number | null | undefined): string {
  if (!price || !cost || cost <= 0) return '—'
  return Math.round((1 - cost / price) * 100) + '%'
}
