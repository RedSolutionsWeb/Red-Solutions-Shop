import type { Customer, Dealer, Invoice, InvoiceLine, Order, Profile, Ticket } from './types'

function csvCell(v: string | number): string {
  const s = String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export interface QboContext {
  invoice: Invoice
  lines: InvoiceLine[]
  customer?: Customer | null
  ticket?: Ticket | null
  order?: Order | null
  dealer?: Dealer | null
  rep?: Profile | null
}

export function invoiceMemo(ctx: QboContext): string {
  let memo = ''
  if (ctx.ticket) {
    memo = `${[ctx.ticket.make, ctx.ticket.model].filter(Boolean).join(' ')} S/N ${ctx.ticket.serial ?? ''} — ticket ${ctx.ticket.id}`
  } else if (ctx.order) {
    const po = ctx.order.po ? ` — PO ${ctx.order.po}` : ''
    memo = `Dealer order ${ctx.order.id}${po} — ${ctx.order.ship_method ?? ''}`
  } else {
    memo = 'Parts sale'
  }
  if (ctx.rep) memo += (memo ? ' — ' : '') + `sold by ${ctx.rep.name}`
  return memo
}

// Exact QuickBooks Online invoice-import column order.
const QBO_HEADER = [
  '*InvoiceNo',
  '*Customer',
  '*InvoiceDate',
  '*DueDate',
  'Terms',
  'Memo',
  'Item(Product/Service)',
  'ItemDescription',
  'ItemQuantity',
  'ItemRate',
  '*ItemAmount',
  'Taxable',
]

export function invoiceToQboRows(ctx: QboContext): string[][] {
  const customerName = ctx.customer?.name ?? ctx.dealer?.name ?? ''
  const memo = invoiceMemo(ctx)
  // invoice.tax_exempt is already the authoritative answer for every
  // invoice source (ticket warranty, dealer resale, or a retail sale's
  // own exempt checkbox) — derive from it directly instead of
  // re-guessing from ticket/order presence.
  const taxable = ctx.invoice.tax_exempt ? 'N' : 'Y'

  return ctx.lines.map((line) => [
    ctx.invoice.id,
    customerName,
    ctx.invoice.date,
    ctx.invoice.due_date ?? '',
    ctx.invoice.terms,
    memo,
    line.kind === 'labor' ? 'Labor' : line.description,
    line.description,
    String(line.qty),
    line.unit_price.toFixed(2),
    line.amount.toFixed(2),
    taxable,
  ])
}

export function toCsv(rows: string[][]): string {
  return [QBO_HEADER, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
