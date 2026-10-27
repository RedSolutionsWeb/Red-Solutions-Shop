import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Customer, Dealer, Invoice, InvoiceLine, Order, Profile, Ticket } from '../lib/types'
import { money } from '../lib/money'
import { Tag } from '../ui/Tag'
import { Button } from '../ui/Button'
import { Dialog } from '../ui/Dialog'
import { downloadCsv, invoiceToQboRows, toCsv } from '../lib/qbo'

export function Invoicing() {
  const navigate = useNavigate()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [customers, setCustomers] = useState<Record<number, Customer>>({})
  const [tickets, setTickets] = useState<Record<string, Ticket>>({})
  const [orders, setOrders] = useState<Record<number, Order>>({})
  const [dealers, setDealers] = useState<Record<number, Dealer>>({})
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [qboOpen, setQboOpen] = useState(false)

  async function load() {
    const [invRes, custRes, tixRes, ordRes, dealerRes, profRes] = await Promise.all([
      supabase.from('invoices').select('*').is('voided_at', null).order('created_at'),
      supabase.from('customers').select('*'),
      supabase.from('tickets').select('*').is('deleted_at', null),
      supabase.from('orders').select('*'),
      supabase.from('dealers').select('*'),
      supabase.from('profiles').select('*'),
    ])
    setInvoices((invRes.data as Invoice[]) ?? [])
    setCustomers(Object.fromEntries(((custRes.data as Customer[]) ?? []).map((c) => [c.id, c])))
    setTickets(Object.fromEntries(((tixRes.data as Ticket[]) ?? []).map((t) => [t.id, t])))
    setOrders(Object.fromEntries(((ordRes.data as Order[]) ?? []).map((o) => [o.id, o])))
    setDealers(Object.fromEntries(((dealerRes.data as Dealer[]) ?? []).map((d) => [d.id, d])))
    setProfiles(Object.fromEntries(((profRes.data as Profile[]) ?? []).map((p) => [p.id, p])))
  }

  useEffect(() => {
    load()
  }, [])

  function customerFor(inv: Invoice) {
    if (inv.ticket_id) {
      const t = tickets[inv.ticket_id]
      return t?.customer_id ? customers[t.customer_id]?.name : ''
    }
    if (inv.order_id) return dealers[orders[inv.order_id]?.dealer_id]?.name ?? ''
    if (inv.customer_id) return customers[inv.customer_id]?.name ?? ''
    return ''
  }

  async function exportAllUnsent() {
    const drafts = invoices.filter((i) => i.qbo_status === 'draft')
    const rows: string[][] = []
    for (const inv of drafts) {
      const { data: lines } = await supabase.from('invoice_lines').select('*').eq('invoice_id', inv.id)
      const ticket = inv.ticket_id ? tickets[inv.ticket_id] : null
      const order = inv.order_id ? orders[inv.order_id] : null
      const customer = ticket?.customer_id ? customers[ticket.customer_id] : null
      const dealer = order ? dealers[order.dealer_id] : null
      const rep = inv.rep ? profiles[inv.rep] : null
      rows.push(...invoiceToQboRows({ invoice: inv, lines: (lines as InvoiceLine[]) ?? [], customer, ticket, order, dealer, rep }))
    }
    downloadCsv(`redsolutions-invoices-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(rows))
    await supabase
      .from('invoices')
      .update({ qbo_status: 'exported' })
      .in('id', drafts.map((d) => d.id))
    load()
  }

  const statusTag = (s: string) =>
    s === 'sent' ? (
      <Tag variant="neutral">Sent to QBO</Tag>
    ) : s === 'exported' ? (
      <Tag variant="accent">Exported</Tag>
    ) : (
      <Tag variant="outline">Draft</Tag>
    )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Invoicing</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={exportAllUnsent}>
            Export all unsent invoices for QuickBooks
          </Button>
          <Button variant="ghost" onClick={() => setQboOpen(true)}>
            QuickBooks connection
          </Button>
        </div>
      </div>

      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Invoice</th>
            <th>Customer</th>
            <th>Ticket</th>
            <th>Date</th>
            <th>Due</th>
            <th>Sold by</th>
            <th>Total</th>
            <th>QBO</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...invoices].reverse().map((inv) => (
            <tr key={inv.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/invoices/${inv.id}`)}>
              <td>{inv.id}</td>
              <td>{customerFor(inv)}</td>
              <td>{inv.ticket_id ?? (inv.order_id ? `Order ${inv.order_id}` : 'Parts sale')}</td>
              <td>{inv.date}</td>
              <td>{inv.due_date}</td>
              <td>{inv.rep ? profiles[inv.rep]?.name ?? 'Unassigned' : 'Unassigned'}</td>
              <td>{money(inv.total)}</td>
              <td>{statusTag(inv.qbo_status)}</td>
              <td>
                <button className="btn btn-ghost">Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {invoices.length === 0 && (
        <div className="muted" style={{ padding: 16 }}>
          No invoices yet. Finish a repair and create one from its ticket.
        </div>
      )}

      {qboOpen && (
        <Dialog
          title="QuickBooks Online connection"
          onClose={() => setQboOpen(false)}
          actions={
            <Button variant="primary" onClick={() => setQboOpen(false)}>
              OK
            </Button>
          }
        >
          Connected to RedSolutions LLC · realm 4620816394. Invoices can be pushed one at a time or exported as a CSV
          batch for Settings → Import data → Invoices.
        </Dialog>
      )}
    </div>
  )
}
