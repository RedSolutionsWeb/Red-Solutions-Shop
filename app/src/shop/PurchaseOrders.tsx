import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useReload } from './ReloadContext'
import { useToast } from '../ui/Toast'
import type { PartView, Profile, PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus } from '../lib/types'
import { money } from '../lib/money'
import { Field, Input, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'
import { Tag } from '../ui/Tag'
import { Dialog } from '../ui/Dialog'
import { searchParts } from '../lib/partSearch'

interface DraftLine {
  sku: string
  name: string
  qty: number
  cost: number
}

const DEFAULT_VENDOR = 'Raptor Dynamic'

function statusTag(s: PurchaseOrderStatus) {
  if (s === 'ordered') return <Tag variant="outline">Ordered</Tag>
  if (s === 'partial') return <Tag variant="accent">Partially received</Tag>
  if (s === 'cancelled') return <Tag variant="outline">Cancelled</Tag>
  return <Tag variant="neutral">Received</Tag>
}

export function PurchaseOrders() {
  const navigate = useNavigate()
  const { identity } = useAuth()
  const toast = useToast()
  const role = identity?.kind === 'staff' ? identity.profile.role : null
  const isManager = role === 'owner' || role === 'sales'

  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [parts, setParts] = useState<PartView[]>([])
  const [creating, setCreating] = useState(false)
  const [vendor, setVendor] = useState(DEFAULT_VENDOR)
  const [notes, setNotes] = useState('')
  const [skuText, setSkuText] = useState('')
  const [qtyText, setQtyText] = useState('1')
  const [costText, setCostText] = useState('')
  const [lines, setLines] = useState<DraftLine[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('purchase_orders').select('*').order('created_at', { ascending: false })
    setOrders((data as PurchaseOrder[]) ?? [])
  }

  useEffect(() => {
    load()
    supabase.from('parts_view').select('*').then(({ data }) => setParts((data as PartView[]) ?? []))
  }, [])

  function resolveSku(text: string): PartView | null {
    const raw = text.trim()
    if (!raw) return null
    const exact = parts.find((p) => p.sku.toLowerCase() === raw.toLowerCase())
    if (exact) return exact
    const beforeDash = raw.split('—')[0].trim()
    const exact2 = parts.find((p) => p.sku.toLowerCase() === beforeDash.toLowerCase())
    if (exact2) return exact2
    const tokens = raw.toLowerCase().split(/[\s,()-]+/).filter(Boolean)
    const matches = parts.filter((p) => {
      const hay = `${p.sku} ${p.name} ${p.category ?? ''}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
    if (matches.length === 1) return matches[0]
    if (matches.length === 0) setError('Type a SKU or part name')
    else setError(`${matches.length} parts match — pick one from the list`)
    return null
  }

  function addLine() {
    setError('')
    const part = resolveSku(skuText)
    if (!part) return
    const qty = Math.max(1, Math.floor(Number(qtyText) || 1))
    const cost = costText.trim() !== '' ? Number(costText) : part.cost ?? 0
    setLines((prev) => {
      const existing = prev.find((l) => l.sku === part.sku)
      if (existing) return prev.map((l) => (l.sku === part.sku ? { ...l, qty: l.qty + qty } : l))
      return [...prev, { sku: part.sku, name: part.name, qty, cost }]
    })
    setSkuText('')
    setQtyText('1')
    setCostText('')
  }

  function removeLine(sku: string) {
    setLines((prev) => prev.filter((l) => l.sku !== sku))
  }

  const total = lines.reduce((s, l) => s + l.qty * l.cost, 0)

  async function createOrder() {
    setError('')
    if (lines.length === 0) {
      setError('Add at least one part.')
      return
    }
    setBusy(true)
    const { data, error: err } = await supabase.rpc('create_purchase_order', {
      p_vendor: vendor,
      p_notes: notes,
      p_lines: lines.map((l) => ({ sku: l.sku, qty: l.qty, cost: l.cost })),
    })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    toast('Purchase order created')
    setCreating(false)
    setVendor(DEFAULT_VENDOR)
    setNotes('')
    setLines([])
    load()
    navigate(`/purchase-orders/${data}`)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Purchase orders</h2>
        {isManager && !creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            New purchase order
          </Button>
        )}
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Enter what you ordered. When it shows up, whoever receives it marks each line in — inventory updates right
        then.
      </p>

      {creating && (
        <div className="card elev-md" style={{ marginTop: 16, padding: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
            <Field label="Vendor">
              <Input value={vendor} onChange={(e) => setVendor(e.target.value)} />
            </Field>
            <Field label="Notes (optional)">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={1} />
            </Field>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginTop: 12 }}>
            <Input
              list="po-part-lookup"
              placeholder={`Search ${parts.length} items…`}
              value={skuText}
              onChange={(e) => setSkuText(e.target.value)}
            />
            <datalist id="po-part-lookup">
              {searchParts(parts, skuText).map((p) => (
                <option key={p.sku} value={`${p.sku} — ${p.name}`}>
                  {p.qty_on_hand} on hand
                </option>
              ))}
            </datalist>
            <Input placeholder="Qty" value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
            <Input placeholder="Unit cost" value={costText} onChange={(e) => setCostText(e.target.value)} />
            <Button variant="secondary" onClick={addLine}>
              Add
            </Button>
          </div>

          {lines.length > 0 && (
            <table className="table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Part</th>
                  <th>Qty</th>
                  <th>Unit cost</th>
                  <th>Line total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.sku}>
                    <td>{l.sku}</td>
                    <td>{l.name}</td>
                    <td>{l.qty}</td>
                    <td>{money(l.cost)}</td>
                    <td>{money(l.qty * l.cost)}</td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => removeLine(l.sku)}>
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12 }}>
            <span>Total</span>
            <span>{money(total)}</span>
          </div>

          {error && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 8 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
            <Button
              variant="secondary"
              onClick={() => {
                setCreating(false)
                setLines([])
                setError('')
              }}
            >
              Cancel
            </Button>
            <Button variant="primary" onClick={createOrder} disabled={busy}>
              Create purchase order
            </Button>
          </div>
        </div>
      )}

      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Vendor</th>
            <th>Created</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchase-orders/${o.id}`)}>
              <td>{o.vendor}</td>
              <td>{new Date(o.created_at).toLocaleDateString()}</td>
              <td>{statusTag(o.status)}</td>
              <td>
                <button className="btn btn-ghost">Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {orders.length === 0 && <div className="muted" style={{ padding: 16 }}>No purchase orders yet.</div>}
    </div>
  )
}

export function PurchaseOrderDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { identity } = useAuth()
  const toast = useToast()
  const { bump } = useReload()
  const role = identity?.kind === 'staff' ? identity.profile.role : null
  const isManager = role === 'owner' || role === 'sales'

  const [order, setOrder] = useState<PurchaseOrder | null>(null)
  const [lines, setLines] = useState<PurchaseOrderLine[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [receiveText, setReceiveText] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  async function load() {
    if (!id) return
    const [{ data: o }, { data: ls }, { data: profs }] = await Promise.all([
      supabase.from('purchase_orders').select('*').eq('id', id).single(),
      supabase.from('purchase_order_lines').select('*').eq('po_id', id).order('id'),
      supabase.from('profiles').select('*'),
    ])
    setOrder(o as PurchaseOrder)
    setLines((ls as PurchaseOrderLine[]) ?? [])
    setProfiles(Object.fromEntries(((profs as Profile[]) ?? []).map((p) => [p.id, p])))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const total = useMemo(() => lines.reduce((s, l) => s + l.qty_ordered * l.cost, 0), [lines])

  async function receiveLine(lineId: number) {
    const text = receiveText[lineId]
    const qty = Number(text)
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('Enter a quantity greater than 0')
      return
    }
    setBusy(true)
    const { error: err } = await supabase.rpc('receive_purchase_order_line', { p_line_id: lineId, p_qty: qty })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    setError('')
    setReceiveText((prev) => ({ ...prev, [lineId]: '' }))
    toast('Received — inventory updated')
    bump()
    load()
  }

  async function cancelOrder() {
    if (!order) return
    setBusy(true)
    const { error: err } = await supabase.rpc('cancel_purchase_order', { p_po_id: order.id })
    setBusy(false)
    setCancelOpen(false)
    if (err) {
      setError(err.message)
      return
    }
    toast('Purchase order cancelled')
    load()
  }

  if (!order) return null

  const closed = order.status === 'received' || order.status === 'cancelled'
  const anyReceived = lines.some((l) => l.qty_received > 0)

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/purchase-orders')}>
        ← Purchase orders
      </Button>
      <div className="card elev-md" style={{ marginTop: 16, padding: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h3 style={{ margin: 0 }}>{order.vendor}</h3>
            <p className="muted" style={{ fontSize: 13, marginTop: 4 }}>
              Ordered {new Date(order.created_at).toLocaleString()}
              {order.created_by && profiles[order.created_by] ? ` by ${profiles[order.created_by].name}` : ''}
            </p>
            {order.notes && <p style={{ fontSize: 13, marginTop: 4 }}>{order.notes}</p>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {statusTag(order.status)}
            {isManager && order.status !== 'cancelled' && !anyReceived && (
              <Button variant="ghost" onClick={() => setCancelOpen(true)}>
                Cancel order
              </Button>
            )}
          </div>
        </div>

        {cancelOpen && (
          <Dialog
            title="Cancel this purchase order?"
            onClose={() => setCancelOpen(false)}
            actions={
              <>
                <Button variant="secondary" onClick={() => setCancelOpen(false)}>
                  Keep it
                </Button>
                <Button variant="primary" onClick={cancelOrder} disabled={busy}>
                  Cancel order
                </Button>
              </>
            }
          >
            Nothing on this order has been received yet, so this is safe.
          </Dialog>
        )}

        {error && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 12 }}>{error}</div>}

        <table className="table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Part</th>
              <th>Ordered</th>
              <th>Received</th>
              <th>Unit cost</th>
              {!closed && <th>Receive</th>}
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => {
              const remaining = l.qty_ordered - l.qty_received
              const lineDone = remaining <= 0
              return (
                <tr key={l.id}>
                  <td>{l.sku}</td>
                  <td>{l.description}</td>
                  <td>{l.qty_ordered}</td>
                  <td style={{ fontWeight: lineDone ? 700 : 400, color: lineDone ? 'var(--color-accent)' : undefined }}>
                    {l.qty_received}
                  </td>
                  <td>{money(l.cost)}</td>
                  {!closed && (
                    <td>
                      {lineDone ? (
                        <span className="muted" style={{ fontSize: 12 }}>
                          done
                        </span>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input
                            className="input"
                            style={{ width: 80 }}
                            type="number"
                            min={0}
                            placeholder={`${remaining}`}
                            value={receiveText[l.id] ?? ''}
                            onChange={(e) => setReceiveText((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          />
                          <Button variant="secondary" onClick={() => receiveLine(l.id)} disabled={busy}>
                            Receive
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: 12 }}>
          <span>Order total</span>
          <span>{money(total)}</span>
        </div>
        {order.status === 'received' && order.received_at && (
          <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Fully received {new Date(order.received_at).toLocaleString()}.
          </p>
        )}
      </div>
    </div>
  )
}
