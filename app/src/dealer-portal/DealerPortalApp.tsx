import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { ToastProvider, useToast } from '../ui/Toast'
import { Button } from '../ui/Button'
import { Field, Input, Select } from '../ui/Field'
import { money } from '../lib/money'
import type { DealerUser } from '../lib/types'
import { Logo } from '../ui/Logo'

interface CatalogPart {
  sku: string
  name: string
  category: string | null
  fits: string[]
  retail: number
  dealer_price: number
  available: number
  backorder: boolean
}

interface CatalogBundle {
  bundle_id: number
  sku: string
  name: string
  components: { sku: string; name: string; qty: number; price: number }[]
  retail_total: number
  dealer_price: number
  buildable: number
}

interface DealerAccount {
  id: number
  name: string
  discount_pct: number
  terms: string
  balance: number
}

interface CartLine {
  key: string
  sku?: string
  bundleId?: number
  name: string
  qty: number
  dealerPrice: number
  retail: number
}

interface OrderRow {
  id: number
  po: string | null
  is_quote: boolean
  status: string
  created_at: string
}

const AIRCRAFT = [
  { key: '', label: 'All aircraft' },
  { key: 'HD580', label: 'Vector HD580' },
  { key: 'C31', label: 'Ceres Air C31' },
]

function DealerPortalInner({ dealerUser }: { dealerUser: DealerUser }) {
  const { signOut } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<'catalog' | 'kits' | 'cart' | 'history'>('catalog')
  const [account, setAccount] = useState<DealerAccount | null>(null)
  const [parts, setParts] = useState<CatalogPart[]>([])
  const [bundles, setBundles] = useState<CatalogBundle[]>([])
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [cart, setCart] = useState<CartLine[]>([])
  const [aircraft, setAircraft] = useState('')
  const [section, setSection] = useState('')
  const [search, setSearch] = useState('')
  const [po, setPo] = useState('')
  const [shipAddress, setShipAddress] = useState('')
  const [shipMethod, setShipMethod] = useState('Ground')

  async function load() {
    const [dealerRes, partsRes, bundlesRes, ordersRes] = await Promise.all([
      supabase.from('dealers').select('id,name,discount_pct,terms,balance').eq('id', dealerUser.dealer_id).single(),
      supabase.from('dealer_catalog').select('*'),
      supabase.from('dealer_bundle_pricing').select('*'),
      supabase.from('orders').select('id,po,is_quote,status,created_at').eq('dealer_id', dealerUser.dealer_id),
    ])
    setAccount(dealerRes.data as DealerAccount)
    setParts((partsRes.data as CatalogPart[]) ?? [])
    setBundles((bundlesRes.data as CatalogBundle[]) ?? [])
    setOrders((ordersRes.data as OrderRow[]) ?? [])
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const scopedParts = useMemo(() => {
    let list = parts
    if (aircraft) list = list.filter((p) => p.fits.includes(aircraft) || p.fits.includes('All'))
    if (section) list = list.filter((p) => p.category === section)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => `${p.sku} ${p.name}`.toLowerCase().includes(q))
    }
    return list
  }, [parts, aircraft, section, search])

  const sections = useMemo(() => {
    const scope = aircraft ? parts.filter((p) => p.fits.includes(aircraft) || p.fits.includes('All')) : parts
    return Array.from(new Set(scope.map((p) => p.category ?? '')))
  }, [parts, aircraft])

  function addToCart(line: CartLine) {
    setCart((c) => {
      const existing = c.find((l) => l.key === line.key)
      if (existing) return c.map((l) => (l.key === line.key ? { ...l, qty: l.qty + line.qty } : l))
      return [...c, line]
    })
    toast(`${line.name} added to cart`)
  }

  function removeFromCart(key: string) {
    setCart((c) => c.filter((l) => l.key !== key))
  }

  const cartTotal = cart.reduce((s, l) => s + l.qty * l.dealerPrice, 0)
  const cartRetail = cart.reduce((s, l) => s + l.qty * l.retail, 0)

  async function submit(isQuote: boolean) {
    if (cart.length === 0) return toast('Add something to the cart first')
    const lines = cart.map((l) => (l.bundleId ? { bundle_id: l.bundleId, qty: l.qty } : { sku: l.sku, qty: l.qty }))
    const { data, error } = await supabase.rpc('submit_dealer_order', {
      p_po: po,
      p_ship_address: shipAddress,
      p_ship_method: shipMethod,
      p_is_quote: isQuote,
      p_lines: lines,
    })
    if (error) return toast(error.message)
    toast(isQuote ? `Quote request submitted — ${data}` : `Order submitted — ${data}`)
    setCart([])
    setPo('')
    load()
    setTab('history')
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'var(--color-bg)',
          borderBottom: '2px solid var(--color-divider)',
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
        }}
      >
        <Logo height={28} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 16, fontSize: 13 }}>
          {account && (
            <span>
              {account.name} · {account.discount_pct}% off retail · balance {money(account.balance)}
            </span>
          )}
          <Button variant="ghost" onClick={() => signOut()}>
            Sign out
          </Button>
        </div>
      </header>

      <nav style={{ display: 'flex', gap: 4, borderBottom: '2px solid var(--color-divider)', padding: '0 24px' }}>
        {(
          [
            ['catalog', 'Catalog'],
            ['kits', 'Complete kits'],
            ['cart', `Cart (${cart.length})`],
            ['history', 'Order history'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            className="btn"
            style={{
              borderBottom: tab === key ? '2px solid var(--color-accent)' : '2px solid transparent',
              color: tab === key ? 'var(--color-accent)' : undefined,
              borderRadius: 0,
            }}
            onClick={() => setTab(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      <main style={{ flex: 1, padding: 24 }}>
        {tab === 'catalog' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <Select
                value={aircraft}
                onChange={(e) => {
                  setAircraft(e.target.value)
                  setSection('')
                }}
              >
                {AIRCRAFT.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </Select>
              <Select value={section} onChange={(e) => setSection(e.target.value)}>
                <option value="">All sections</option>
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
              <Input placeholder="Search SKU or name…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Part</th>
                  <th>Retail</th>
                  <th>Your price</th>
                  <th>Stock</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {scopedParts.map((p) => (
                  <CatalogRow key={p.sku} part={p} onAdd={addToCart} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'kits' && (
          <div>
            {bundles.length === 0 && <div className="muted">No complete kits available yet.</div>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
              {bundles.map((b) => (
                <BundleCard key={b.bundle_id} bundle={b} onAdd={addToCart} />
              ))}
            </div>
          </div>
        )}

        {tab === 'cart' && (
          <div>
            <table className="table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Price</th>
                  <th>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.key}>
                    <td>{l.name}</td>
                    <td>{l.qty}</td>
                    <td>{money(l.dealerPrice)}</td>
                    <td>{money(l.qty * l.dealerPrice)}</td>
                    <td>
                      <button className="btn btn-ghost" onClick={() => removeFromCart(l.key)}>
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cart.length === 0 && <div className="muted" style={{ padding: 16 }}>Your cart is empty.</div>}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 20, maxWidth: 500 }}>
              <Field label="PO number">
                <Input value={po} onChange={(e) => setPo(e.target.value)} />
              </Field>
              <Field label="Shipping method">
                <Select value={shipMethod} onChange={(e) => setShipMethod(e.target.value)}>
                  <option>Ground</option>
                  <option>Expedited</option>
                  <option>Will call</option>
                </Select>
              </Field>
              <div style={{ gridColumn: '1 / -1' }}>
                <Field label="Shipping address">
                  <Input value={shipAddress} onChange={(e) => setShipAddress(e.target.value)} />
                </Field>
              </div>
            </div>

            <div style={{ marginTop: 16, maxWidth: 260 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="muted">Retail value</span>
                <span>
                  <s>{money(cartRetail)}</s>
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800 }}>
                <span>Total</span>
                <span>{money(cartTotal)}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button variant="primary" onClick={() => submit(false)}>
                Submit order
              </Button>
              <Button variant="secondary" onClick={() => submit(true)}>
                Request a quote instead
              </Button>
            </div>
          </div>
        )}

        {tab === 'history' && (
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Type</th>
                <th>Date</th>
                <th>PO</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {[...orders].reverse().map((o) => (
                <tr key={o.id}>
                  <td>{o.is_quote ? `Q-${o.id}` : `DO-${o.id}`}</td>
                  <td>{o.is_quote ? 'Quote' : 'Order'}</td>
                  <td>{new Date(o.created_at).toLocaleDateString()}</td>
                  <td>{o.po || '—'}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </main>
    </div>
  )
}

function CatalogRow({ part, onAdd }: { part: CatalogPart; onAdd: (l: CartLine) => void }) {
  const [qty, setQty] = useState('1')
  return (
    <tr>
      <td>{part.sku}</td>
      <td>{part.name}</td>
      <td>
        <s>{money(part.retail)}</s>
      </td>
      <td>{money(part.dealer_price)}</td>
      <td style={{ color: part.backorder ? 'var(--color-accent)' : undefined }}>
        {part.backorder ? 'Backorder' : `${part.available} in stock`}
      </td>
      <td style={{ display: 'flex', gap: 6 }}>
        <Input style={{ width: 56 }} value={qty} onChange={(e) => setQty(e.target.value)} />
        <button
          className="btn btn-secondary"
          onClick={() =>
            onAdd({
              key: part.sku,
              sku: part.sku,
              name: part.name,
              qty: Math.max(1, Number(qty) || 1),
              dealerPrice: part.dealer_price,
              retail: part.retail,
            })
          }
        >
          Add
        </button>
      </td>
    </tr>
  )
}

function BundleCard({ bundle, onAdd }: { bundle: CatalogBundle; onAdd: (l: CartLine) => void }) {
  const [qty, setQty] = useState('1')
  return (
    <div className="card elev-sm">
      <div className="card-title">{bundle.name}</div>
      <div className="muted" style={{ fontSize: 11 }}>
        {bundle.components.map((c) => `${c.qty} × ${c.name}`).join(', ')}
      </div>
      <div>
        <s>{money(bundle.retail_total)}</s> <strong>{money(bundle.dealer_price)}</strong>
      </div>
      <div className="muted" style={{ fontSize: 12 }}>
        {bundle.buildable > 0 ? `${bundle.buildable} buildable` : 'Build to order'}
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <Input style={{ width: 56 }} value={qty} onChange={(e) => setQty(e.target.value)} />
        <button
          className="btn btn-secondary"
          onClick={() =>
            onAdd({
              key: `bundle-${bundle.bundle_id}`,
              bundleId: bundle.bundle_id,
              name: bundle.name,
              qty: Math.max(1, Number(qty) || 1),
              dealerPrice: bundle.dealer_price,
              retail: bundle.retail_total,
            })
          }
        >
          Add
        </button>
      </div>
    </div>
  )
}

export function DealerPortalApp() {
  const { identity } = useAuth()
  if (identity?.kind !== 'dealer') return null
  return (
    <ToastProvider>
      <DealerPortalInner dealerUser={identity.dealerUser} />
    </ToastProvider>
  )
}
