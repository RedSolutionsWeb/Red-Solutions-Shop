import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useReload } from './ReloadContext'
import { useToast } from '../ui/Toast'
import type { Customer, PartView } from '../lib/types'
import { money } from '../lib/money'
import { Field, Input, Select } from '../ui/Field'
import { Button } from '../ui/Button'

interface CartLine {
  sku: string
  name: string
  price: number
  qty: number
}

const AIRCRAFT = [
  { key: '', label: 'All aircraft' },
  { key: 'HD580', label: 'Vector HD580' },
  { key: 'C31', label: 'Ceres Air C31' },
]

export function RetailSale() {
  const navigate = useNavigate()
  const { bump } = useReload()
  const toast = useToast()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [parts, setParts] = useState<PartView[]>([])
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [aircraft, setAircraft] = useState('')
  const [section, setSection] = useState('')
  const [skuText, setSkuText] = useState('')
  const [qtyText, setQtyText] = useState('1')
  const [taxExempt, setTaxExempt] = useState(false)
  const [cart, setCart] = useState<CartLine[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('customers').select('*').order('name').then(({ data }) => setCustomers((data as Customer[]) ?? []))
    supabase.from('parts_view').select('*').then(({ data }) => setParts((data as PartView[]) ?? []))
  }, [])

  function pickCustomer(id: string) {
    setCustomerId(id)
    const c = customers.find((c) => String(c.id) === id)
    if (c) {
      setName(c.name)
      setContact(c.contact ?? '')
      setPhone(c.phone ?? '')
      setEmail(c.email ?? '')
    }
  }

  const sellableParts = useMemo(() => {
    let list = parts
    if (aircraft) list = list.filter((p) => p.fits.includes(aircraft) || p.fits.includes('All'))
    if (section) list = list.filter((p) => p.category === section)
    return list
  }, [parts, aircraft, section])

  const sections = useMemo(() => {
    const scope = aircraft ? parts.filter((p) => p.fits.includes(aircraft) || p.fits.includes('All')) : parts
    const cats = new Map<string, number>()
    for (const p of scope) cats.set(p.category ?? '', (cats.get(p.category ?? '') ?? 0) + 1)
    return Array.from(cats.entries())
  }, [parts, aircraft])

  function resolveSku(text: string): PartView | null {
    const raw = text.trim()
    if (!raw) return null
    const exact = sellableParts.find((p) => p.sku.toLowerCase() === raw.toLowerCase())
    if (exact) return exact
    const beforeDash = raw.split('—')[0].trim()
    const exact2 = sellableParts.find((p) => p.sku.toLowerCase() === beforeDash.toLowerCase())
    if (exact2) return exact2
    const tokens = raw.toLowerCase().split(/[\s,()-]+/).filter(Boolean)
    const matches = sellableParts.filter((p) => {
      const hay = `${p.sku} ${p.name} ${p.category ?? ''}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
    if (matches.length === 1) return matches[0]
    if (matches.length === 0) setError('Type a SKU or part name')
    else setError(`${matches.length} parts match — pick one from the list`)
    return null
  }

  function addToCart() {
    setError('')
    const part = resolveSku(skuText)
    if (!part) return
    const qty = Math.max(1, Number(qtyText) || 1)
    setCart((prev) => {
      const existing = prev.find((l) => l.sku === part.sku)
      if (existing) {
        return prev.map((l) => (l.sku === part.sku ? { ...l, qty: l.qty + qty } : l))
      }
      return [...prev, { sku: part.sku, name: part.name, price: part.price, qty }]
    })
    setSkuText('')
    setQtyText('1')
  }

  function removeLine(sku: string) {
    setCart((prev) => prev.filter((l) => l.sku !== sku))
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0)

  async function completeSale() {
    setError('')
    if (!customerId && !name.trim()) {
      setError('Pick an existing customer or enter a name.')
      return
    }
    if (cart.length === 0) {
      setError('Add at least one part.')
      return
    }
    setBusy(true)
    try {
      let custId = customerId ? Number(customerId) : null
      if (!custId) {
        const { data, error: custError } = await supabase
          .from('customers')
          .insert({ name: name.trim(), contact, phone, email })
          .select()
          .single()
        if (custError) throw custError
        custId = (data as Customer).id
      }

      const { data: invoiceId, error: saleError } = await supabase.rpc('create_retail_sale', {
        p_customer_id: custId,
        p_lines: cart.map((l) => ({ sku: l.sku, qty: l.qty })),
        p_tax_exempt: taxExempt,
      })
      if (saleError) throw saleError

      toast(`${invoiceId} created`)
      bump()
      navigate(`/invoices/${invoiceId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not complete the sale.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2 style={{ margin: 0 }}>Parts sale</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        For a walk-in or outbound parts order with no aircraft involved — invoices straight away, no ticket.
      </p>

      <h5 style={{ marginTop: 20 }}>Customer</h5>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Existing customer">
          <Select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
            <option value="">New customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Company / customer name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Contact">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Email (for the QuickBooks invoice)">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
      </div>

      <hr className="hr" />

      <h5 style={{ margin: 0 }}>Parts</h5>
      <table className="table" style={{ marginTop: 8 }}>
        <thead>
          <tr>
            <th>SKU / part</th>
            <th>Qty</th>
            <th>Price</th>
            <th>Amount</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {cart.map((l) => (
            <tr key={l.sku}>
              <td>
                {l.sku} — {l.name}
              </td>
              <td>{l.qty}</td>
              <td>{money(l.price)}</td>
              <td>{money(l.qty * l.price)}</td>
              <td>
                <button className="btn btn-ghost" onClick={() => removeLine(l.sku)}>
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {cart.length === 0 && (
        <div className="muted" style={{ padding: 12, fontSize: 13 }}>
          No parts added yet.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
        <Select
          value={aircraft}
          onChange={(e) => {
            setAircraft(e.target.value)
            setSection('')
            setSkuText('')
          }}
        >
          {AIRCRAFT.map((a) => (
            <option key={a.key} value={a.key}>
              {a.label}
            </option>
          ))}
        </Select>
        <Select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections ({sellableParts.length})</option>
          {sections.map(([cat, count]) => (
            <option key={cat} value={cat}>
              {cat} ({count})
            </option>
          ))}
        </Select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginTop: 8 }}>
        <Input
          list="retail-part-lookup"
          placeholder={`Search ${sellableParts.length} items…`}
          value={skuText}
          onChange={(e) => setSkuText(e.target.value)}
        />
        <datalist id="retail-part-lookup">
          {sellableParts.slice(0, 60).map((p) => (
            <option key={p.sku} value={`${p.sku} — ${p.name}`}>
              {p.category === 'Service' ? `service, ${money(p.price)}` : `${p.qty_on_hand} on hand, ${money(p.price)}`}
            </option>
          ))}
        </datalist>
        <Input value={qtyText} onChange={(e) => setQtyText(e.target.value)} />
        <Button variant="secondary" onClick={addToCart}>
          Add
        </Button>
      </div>

      <label className="radio" style={{ marginTop: 16 }}>
        <input type="checkbox" checked={taxExempt} onChange={(e) => setTaxExempt(e.target.checked)} />
        <span className="dot" />
        Tax exempt
      </label>

      <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 16, paddingTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800 }}>
          <span>Subtotal</span>
          <span>{money(subtotal)}</span>
        </div>
        <p className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          Tax is calculated at the shop's rate when the invoice is created.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Cancel
        </Button>
        <Button variant="primary" onClick={completeSale} disabled={busy}>
          Complete sale &amp; create invoice
        </Button>
      </div>
      {error && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </div>
  )
}
