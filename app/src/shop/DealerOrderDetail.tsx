import { useEffect, useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReload } from './ReloadContext'
import { useToast } from '../ui/Toast'
import type { Dealer, Order, OrderLine, PartView } from '../lib/types'
import { money } from '../lib/money'
import { Button } from '../ui/Button'
import { Tag } from '../ui/Tag'

export function DealerOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { bump } = useReload()
  const toast = useToast()

  const [order, setOrder] = useState<Order | null>(null)
  const [dealer, setDealer] = useState<Dealer | null>(null)
  const [lines, setLines] = useState<OrderLine[]>([])
  const [parts, setParts] = useState<Record<string, PartView>>({})
  const [invoiceId, setInvoiceId] = useState<string | null>(null)

  async function load() {
    if (!id) return
    const { data: o } = await supabase.from('orders').select('*').eq('id', id).single()
    setOrder(o as Order)
    if (o?.dealer_id) {
      const { data: d } = await supabase.from('dealers').select('*').eq('id', o.dealer_id).single()
      setDealer(d as Dealer)
    }
    const { data: ls } = await supabase.from('order_lines').select('*').eq('order_id', id)
    setLines((ls as OrderLine[]) ?? [])
    const { data: p } = await supabase.from('parts_view').select('*')
    setParts(Object.fromEntries(((p as PartView[]) ?? []).map((x) => [x.sku, x])))
    const { data: inv } = await supabase.from('invoices').select('id').eq('order_id', id).maybeSingle()
    setInvoiceId((inv as { id: string } | null)?.id ?? null)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function approve() {
    if (!order) return
    const { error } = await supabase.rpc('approve_dealer_order', { p_order_id: order.id })
    if (error) return toast(error.message)
    load()
    bump()
  }

  async function reject() {
    if (!order) return
    const { error } = await supabase.rpc('reject_dealer_order', { p_order_id: order.id })
    if (error) return toast(error.message)
    load()
    bump()
  }

  async function invoiceOrder() {
    if (!order) return
    const { data, error } = await supabase.rpc('invoice_dealer_order', { p_order_id: order.id })
    if (error) return toast(error.message)
    bump()
    navigate(`/invoices/${data}`)
  }

  if (!order || !dealer) return null

  const retailValue = lines.reduce((s, l) => s + l.qty * l.retail, 0)
  const total = lines.reduce((s, l) => s + l.qty * l.price, 0)
  const discountAmt = retailValue - total
  const discountPct = retailValue > 0 ? Math.round((discountAmt / retailValue) * 100) : 0

  const canDecide = order.status === 'submitted' || order.status === 'quote_requested'
  const canInvoice = !invoiceId && order.status !== 'rejected'

  const statusTag =
    order.status === 'invoiced' ? (
      <Tag variant="neutral">Invoiced</Tag>
    ) : order.status === 'approved' ? (
      <Tag variant="accent">Approved</Tag>
    ) : order.status === 'rejected' ? (
      <Tag variant="outline">Rejected</Tag>
    ) : (
      <Tag variant="outline">{order.status === 'quote_requested' ? 'Quote requested' : 'Submitted'}</Tag>
    )

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/orders')}>
        ← Dealer orders
      </Button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
        <div>
          <div className="kicker">
            {order.is_quote ? 'Quote request' : 'Purchase order'} · {order.is_quote ? `Q-${order.id}` : `DO-${order.id}`}
          </div>
          <h2 style={{ margin: 0 }}>{dealer.name}</h2>
          <div className="muted" style={{ fontSize: 13 }}>
            {[dealer.contact, dealer.phone, dealer.email].filter(Boolean).join('  ·  ')}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            {new Date(order.created_at).toLocaleDateString()} · PO {order.po || '—'} · {dealer.discount_pct}% off retail · {dealer.terms}
            <br />
            {order.ship_method} — {order.ship_address}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {statusTag}
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 4 }}>{money(total)}</div>
        </div>
      </div>

      <hr className="hr" />

      <table className="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Part</th>
            <th>Qty</th>
            <th>Stock</th>
            <th>Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const p = l.sku ? parts[l.sku] : null
            const onHand = p?.qty_on_hand ?? 0
            const short = l.sku ? onHand < l.qty : false
            return (
              <tr key={l.id}>
                <td>{l.sku ?? '—'}</td>
                <td>{l.name}</td>
                <td>{l.qty}</td>
                <td style={{ color: short ? 'var(--color-accent)' : undefined }}>
                  {l.sku ? (short ? `short ${l.qty - onHand}` : `${onHand} on hand`) : ''}
                </td>
                <td>{money(l.price)}</td>
                <td>{money(l.qty * l.price)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div style={{ marginLeft: 'auto', width: 260, marginTop: 16 }}>
        <Row label="Retail value" value={<s>{money(retailValue)}</s>} />
        <Row label={`Dealer discount ${discountPct}%`} value={`−${money(discountAmt)}`} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, marginTop: 6 }}>
          <span>Total</span>
          <span>{money(total)}</span>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
        {canDecide && (
          <>
            <Button variant="primary" onClick={approve}>
              Approve order
            </Button>
            <Button variant="secondary" onClick={reject}>
              Reject
            </Button>
          </>
        )}
        {canInvoice && (
          <Button variant="primary" onClick={invoiceOrder}>
            Invoice &amp; allocate stock
          </Button>
        )}
        {invoiceId && (
          <Button variant="secondary" onClick={() => navigate(`/invoices/${invoiceId}`)}>
            View invoice {invoiceId}
          </Button>
        )}
      </div>
      <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
        Invoicing pulls each line out of on-hand stock, the same as a repair ticket. Dealer purchases are treated as
        resale, so no sales tax is added.
      </p>
    </div>
  )

  function Row({ label, value }: { label: string; value: ReactNode }) {
    return (
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
        <span className="muted">{label}</span>
        <span>{value}</span>
      </div>
    )
  }
}
