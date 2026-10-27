import { Fragment, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../ui/Toast'
import type { Customer, Dealer, Invoice, InvoiceLine, Order, Profile, Ticket } from '../lib/types'
import { money } from '../lib/money'
import { Button } from '../ui/Button'
import { Select } from '../ui/Field'
import { Dialog } from '../ui/Dialog'
import { Tag } from '../ui/Tag'
import { downloadCsv, invoiceToQboRows, toCsv } from '../lib/qbo'
import { Logo } from '../ui/Logo'

export function InvoiceDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { identity } = useAuth()
  const toast = useToast()
  const isOwner = identity?.kind === 'staff' && identity.profile.role === 'owner'
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<InvoiceLine[]>([])
  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [order, setOrder] = useState<Order | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [dealer, setDealer] = useState<Dealer | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [sendOpen, setSendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function load() {
    if (!id) return
    const { data: inv } = await supabase.from('invoices').select('*').eq('id', id).single()
    setInvoice(inv as Invoice)
    const { data: ls } = await supabase.from('invoice_lines').select('*').eq('invoice_id', id).order('id')
    setLines((ls as InvoiceLine[]) ?? [])
    const { data: profs } = await supabase.from('profiles').select('*')
    setProfiles((profs as Profile[]) ?? [])

    if (inv?.ticket_id) {
      const { data: t } = await supabase.from('tickets').select('*').eq('id', inv.ticket_id).single()
      setTicket(t as Ticket)
      if (t?.customer_id) {
        const { data: c } = await supabase.from('customers').select('*').eq('id', t.customer_id).single()
        setCustomer(c as Customer)
      }
    }
    if (inv?.order_id) {
      const { data: o } = await supabase.from('orders').select('*').eq('id', inv.order_id).single()
      setOrder(o as Order)
      if (o?.dealer_id) {
        const { data: d } = await supabase.from('dealers').select('*').eq('id', o.dealer_id).single()
        setDealer(d as Dealer)
      }
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function setRep(repId: string) {
    if (!invoice) return
    await supabase.from('invoices').update({ rep: repId || null }).eq('id', invoice.id)
    setInvoice({ ...invoice, rep: repId || null })
  }

  function ctx() {
    return { invoice: invoice!, lines, customer, ticket, order, dealer, rep: profiles.find((p) => p.id === invoice?.rep) ?? null }
  }

  async function downloadInvoiceCsv() {
    if (!invoice) return
    downloadCsv(`${invoice.id}-quickbooks.csv`, toCsv(invoiceToQboRows(ctx())))
    if (invoice.qbo_status === 'draft') {
      await supabase.from('invoices').update({ qbo_status: 'exported' }).eq('id', invoice.id)
      setInvoice({ ...invoice, qbo_status: 'exported' })
    }
  }

  async function sendToQbo() {
    if (!invoice) return
    await supabase.from('invoices').update({ qbo_status: 'sent' }).eq('id', invoice.id)
    setInvoice({ ...invoice, qbo_status: 'sent' })
    setSendOpen(false)
  }

  async function deleteInvoice() {
    if (!invoice) return
    setDeleteError('')
    const { error } = await supabase.rpc('void_invoice', { p_invoice_id: invoice.id })
    if (error) {
      setDeleteError(error.message)
      return
    }
    setDeleteOpen(false)
    toast(`${invoice.id} deleted`)
    navigate('/invoices')
  }

  if (!invoice) return null

  const taxLabel = order ? 'resale — exempt' : invoice.tax_exempt ? 'exempt' : `${(invoice.tax_rate * 100).toFixed(1)}%`
  const statusTag =
    invoice.qbo_status === 'sent' ? (
      <Tag variant="neutral">Sent to QBO</Tag>
    ) : invoice.qbo_status === 'exported' ? (
      <Tag variant="accent">Exported</Tag>
    ) : (
      <Tag variant="outline">Draft</Tag>
    )

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/invoices')}>
        ← Invoicing
      </Button>

      <div className="card elev-md" style={{ maxWidth: 800, margin: '16px auto', padding: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            <Logo height={56} />
            <p style={{ fontSize: 12 }}>
              Drone service &amp; repair
              <br />
              48303 115th Ave, Leigh NE 68643
            </p>
            <div className="kicker">Bill to</div>
            <div>{customer?.name ?? dealer?.name}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              {customer?.email}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div className="kicker">Invoice</div>
            <div style={{ fontSize: 26, fontWeight: 800 }}>{invoice.id}</div>
            <div className="muted" style={{ fontSize: 12 }}>
              Date {invoice.date}
              <br />
              Due {invoice.due_date} · {invoice.terms}
              <br />
              {ticket ? `Ticket ${ticket.id}` : order ? `Order ${order.id}` : ''}
            </div>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <Select value={invoice.rep ?? ''} onChange={(e) => setRep(e.target.value)} style={{ maxWidth: 240 }}>
            <option value="">Unassigned</option>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>

        <hr className="hr" />

        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Description</th>
              <th>Qty</th>
              <th>Rate</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <Fragment key={l.id}>
                <tr>
                  <td>{l.kind === 'labor' ? 'Labor' : l.description}</td>
                  <td>{l.description}</td>
                  <td>{l.qty}</td>
                  <td>{money(l.unit_price)}</td>
                  <td>{money(l.amount)}</td>
                </tr>
                {l.kit && (
                  <tr>
                    <td colSpan={5} style={{ paddingLeft: 20, borderLeft: '2px solid var(--color-divider)', fontSize: 12 }}>
                      Includes: {l.kit.map((k) => `${k.qty} × ${k.sku}  ${k.name}`).join(', ')}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

        <div style={{ marginLeft: 'auto', width: 260, marginTop: 16 }}>
          <Row label="Subtotal" value={money(invoice.subtotal)} />
          <Row label={`Sales tax (${taxLabel})`} value={invoice.tax_exempt ? taxLabel : money(invoice.tax_amount)} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, marginTop: 6 }}>
            <span>Total</span>
            <span>{money(invoice.total)}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center' }}>
          {invoice.qbo_link ? (
            <Button variant="primary" onClick={() => window.open(invoice.qbo_link!, '_blank')}>
              View in QuickBooks
            </Button>
          ) : (
            <Button variant="primary" onClick={() => setSendOpen(true)}>
              Send to QuickBooks Online
            </Button>
          )}
          <Button variant="secondary" onClick={downloadInvoiceCsv}>
            Download QuickBooks CSV
          </Button>
          <Button
            variant="secondary"
            onClick={() => navigate(ticket ? `/tickets/${ticket.id}` : `/orders/${order?.id}`)}
          >
            {ticket ? 'Back to ticket' : 'Back to order'}
          </Button>
          {isOwner && (
            <Button variant="ghost" onClick={() => setDeleteOpen(true)}>
              Delete invoice
            </Button>
          )}
          <div style={{ marginLeft: 'auto' }}>{statusTag}</div>
        </div>

        <p className="muted" style={{ fontSize: 11, marginTop: 16 }}>
          The CSV matches QuickBooks Online's invoice import columns, so it drops straight into Settings → Import
          data → Invoices. Item names match your inventory SKUs, so QBO maps them to products/services on first
          import.
        </p>
      </div>

      {sendOpen && (
        <Dialog
          title={`Send ${invoice.id} to QuickBooks Online`}
          onClose={() => setSendOpen(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setSendOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={sendToQbo}>
                Send invoice
              </Button>
            </>
          }
        >
          Company file: RedSolutions LLC (connected). Lines post as products/services matching your inventory SKUs;
          labor posts to Service Income. Sales tax is included for billable jobs and left off warranty and insurance
          work.
        </Dialog>
      )}

      {deleteOpen && (
        <Dialog
          title={`Delete ${invoice.id}?`}
          onClose={() => setDeleteOpen(false)}
          actions={
            <>
              <Button variant="secondary" onClick={() => setDeleteOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={deleteInvoice}>
                Delete invoice
              </Button>
            </>
          }
        >
          {invoice.qbo_invoice_id ? (
            <p>
              This invoice was already sent to QuickBooks. Deleting it here will <strong>not</strong> remove it
              there — you'll need to delete or void it in QuickBooks separately, or it'll be left orphaned.
            </p>
          ) : (
            <p>This invoice was never sent to QuickBooks, so it's safe to delete.</p>
          )}
          <p>
            {ticket
              ? 'The ticket goes back to "In Repair" so it can be re-invoiced.'
              : 'The dealer order goes back to "Approved", its stock is restored, and the balance charge is reversed.'}
          </p>
          {deleteError && <div style={{ color: 'var(--color-accent)', fontSize: 12 }}>{deleteError}</div>}
        </Dialog>
      )}
    </div>
  )

  function Row({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span className="muted">{label}</span>
        <span>{value}</span>
      </div>
    )
  }
}
