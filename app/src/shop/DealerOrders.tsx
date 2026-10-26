import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Dealer, Order, OrderLine } from '../lib/types'
import { money } from '../lib/money'
import { Tag } from '../ui/Tag'

interface Row extends Order {
  dealerName: string
  lineCount: number
  total: number
}

export function DealerOrders() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    async function load() {
      const [ordersRes, dealersRes, linesRes] = await Promise.all([
        supabase.from('orders').select('*'),
        supabase.from('dealers').select('*'),
        supabase.from('order_lines').select('*'),
      ])
      const dealers = Object.fromEntries(((dealersRes.data as Dealer[]) ?? []).map((d) => [d.id, d]))
      const lines = (linesRes.data as OrderLine[]) ?? []
      const list = ((ordersRes.data as Order[]) ?? []).map((o) => {
        const oLines = lines.filter((l) => l.order_id === o.id)
        return {
          ...o,
          dealerName: dealers[o.dealer_id]?.name ?? '',
          lineCount: oLines.length,
          total: oLines.reduce((s, l) => s + l.qty * l.price, 0),
        }
      })
      setRows(list)
    }
    load()
  }, [])

  const statusTag = (s: string) =>
    s === 'invoiced' ? (
      <Tag variant="neutral">Invoiced</Tag>
    ) : s === 'approved' ? (
      <Tag variant="accent">Approved</Tag>
    ) : s === 'rejected' ? (
      <Tag variant="outline">Rejected</Tag>
    ) : (
      <Tag variant="outline">{s === 'quote_requested' ? 'Quote requested' : 'Submitted'}</Tag>
    )

  return (
    <div>
      <h2 style={{ margin: 0 }}>Dealer orders</h2>
      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Order</th>
            <th>Dealer</th>
            <th>Type</th>
            <th>Date</th>
            <th>PO</th>
            <th>Lines</th>
            <th>Total</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {[...rows].reverse().map((r) => (
            <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/orders/${r.id}`)}>
              <td>{r.is_quote ? `Q-${r.id}` : `DO-${r.id}`}</td>
              <td>{r.dealerName}</td>
              <td>{r.is_quote ? 'Quote' : 'Order'}</td>
              <td>{new Date(r.created_at).toLocaleDateString()}</td>
              <td>{r.po || '—'}</td>
              <td>{r.lineCount}</td>
              <td>{money(r.total)}</td>
              <td>{statusTag(r.status)}</td>
              <td>
                <button className="btn btn-ghost">Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && (
        <div className="muted" style={{ padding: 16 }}>
          No dealer orders yet. Orders submitted through the dealer portal land here.
        </div>
      )}
    </div>
  )
}
