import { Fragment, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShopSettings } from '../lib/useShopSettings'
import { useReload } from './ReloadContext'
import { useToast } from '../ui/Toast'
import { money } from '../lib/money'
import { STAGES } from '../lib/types'
import type { Customer, LaborLine, PartLine, PartView, Profile, Ticket, Warranty, BundlePricing } from '../lib/types'
import { Button } from '../ui/Button'
import { Field, Input, Select, Textarea } from '../ui/Field'

const AIRCRAFT = [
  { key: '', label: 'All aircraft' },
  { key: 'HD580', label: 'Vector HD580' },
  { key: 'C31', label: 'Ceres Air C31' },
]

export function TicketDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const settings = useShopSettings()
  const { bump } = useReload()
  const toast = useToast()

  const [ticket, setTicket] = useState<Ticket | null>(null)
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [labor, setLabor] = useState<LaborLine[]>([])
  const [partLines, setPartLines] = useState<PartLine[]>([])
  const [parts, setParts] = useState<PartView[]>([])
  const [bundles, setBundles] = useState<BundlePricing[]>([])
  const [techs, setTechs] = useState<Profile[]>([])
  const [invoiceId, setInvoiceId] = useState<string | null>(null)

  const [aircraft, setAircraft] = useState('')
  const [section, setSection] = useState('')
  const [skuText, setSkuText] = useState('')
  const [pullQty, setPullQty] = useState('1')
  const [bundlePick, setBundlePick] = useState('')
  const [bundleQty, setBundleQty] = useState('1')
  const [laborDesc, setLaborDesc] = useState('')
  const [laborHours, setLaborHours] = useState('')
  const [laborRate, setLaborRate] = useState('')
  const [flash, setFlash] = useState('')

  async function load() {
    if (!id) return
    const [tRes, laborRes, linesRes, partsRes, bundlesRes, profilesRes, invRes] = await Promise.all([
      supabase.from('tickets').select('*').eq('id', id).single(),
      supabase.from('labor_lines').select('*').eq('ticket_id', id).order('id'),
      supabase.from('part_lines').select('*').eq('ticket_id', id).order('id'),
      supabase.from('parts_view').select('*'),
      supabase.from('bundle_pricing').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('invoices').select('id').eq('ticket_id', id).maybeSingle(),
    ])
    setTicket(tRes.data as Ticket)
    setLabor((laborRes.data as LaborLine[]) ?? [])
    setPartLines((linesRes.data as PartLine[]) ?? [])
    setParts((partsRes.data as PartView[]) ?? [])
    setBundles((bundlesRes.data as BundlePricing[]) ?? [])
    setTechs((profilesRes.data as Profile[]) ?? [])
    setInvoiceId((invRes.data as { id: string } | null)?.id ?? null)
    if (tRes.data?.customer_id) {
      const { data } = await supabase.from('customers').select('*').eq('id', tRes.data.customer_id).single()
      setCustomer(data as Customer)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  async function saveTicket(patch: Partial<Ticket>) {
    if (!ticket) return
    setTicket({ ...ticket, ...patch })
    await supabase.from('tickets').update(patch).eq('id', ticket.id)
    bump()
  }

  const laborTotal = labor.reduce((s, l) => s + Number(l.hours) * Number(l.rate), 0)
  const partsTotal = partLines.reduce((s, p) => s + Number(p.qty) * Number(p.price), 0)
  const partsCount = partLines.reduce((s, p) => s + Number(p.qty), 0)
  const subtotal = laborTotal + partsTotal
  const taxable = ticket?.warranty === 'none'
  const tax = taxable ? Math.round(subtotal * settings.tax_rate * 100) / 100 : 0
  const grand = subtotal + tax

  const scopedParts = useMemo(() => {
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

  async function addLabor() {
    if (!ticket) return
    if (!laborDesc.trim()) {
      setFlash('Describe the work first')
      return
    }
    const hours = Number(laborHours) || 1
    const rate = Number(laborRate) || settings.labor_rate
    await supabase.from('labor_lines').insert({ ticket_id: ticket.id, description: laborDesc, hours, rate })
    setLaborDesc('')
    setLaborHours('')
    setLaborRate('')
    load()
  }

  async function removeLabor(lineId: number) {
    await supabase.from('labor_lines').delete().eq('id', lineId)
    load()
  }

  function resolveSku(text: string): PartView | null {
    const raw = text.trim()
    if (!raw) return null
    const exact = scopedParts.find((p) => p.sku.toLowerCase() === raw.toLowerCase())
    if (exact) return exact
    const beforeDash = raw.split('—')[0].trim()
    const exact2 = scopedParts.find((p) => p.sku.toLowerCase() === beforeDash.toLowerCase())
    if (exact2) return exact2
    const tokens = raw.toLowerCase().split(/[\s,()-]+/).filter(Boolean)
    const matches = scopedParts.filter((p) => {
      const hay = `${p.sku} ${p.name} ${p.category ?? ''}`.toLowerCase()
      return tokens.every((t) => hay.includes(t))
    })
    if (matches.length === 1) return matches[0]
    if (matches.length === 0) setFlash('Type a SKU or part name')
    else setFlash(`${matches.length} parts match — pick one from the list`)
    return null
  }

  async function pullPart() {
    if (!ticket) return
    const part = resolveSku(skuText)
    if (!part) return
    const qty = Math.max(1, Number(pullQty) || 1)
    const { data, error } = await supabase.rpc('pull_part', { p_ticket_id: ticket.id, p_sku: part.sku, p_qty: qty })
    if (error) {
      setFlash(error.message)
      return
    }
    const newQty = (data as { new_qty: number }[])?.[0]?.new_qty ?? 0
    const onHand = newQty
    if (part.category !== 'Service' && onHand < 0) {
      setFlash(`${qty} × ${part.sku} added — short ${-onHand}, needs ordering`)
    } else {
      setFlash(`${qty} × ${part.sku} pulled — ${onHand} left on hand`)
    }
    setSkuText('')
    setPullQty('1')
    load()
  }

  async function pullBundle() {
    if (!ticket || !bundlePick) return
    const qty = Math.max(1, Number(bundleQty) || 1)
    const { error } = await supabase.rpc('pull_bundle', {
      p_ticket_id: ticket.id,
      p_bundle_id: Number(bundlePick),
      p_qty: qty,
    })
    if (error) {
      setFlash(error.message)
      return
    }
    setBundlePick('')
    setBundleQty('1')
    load()
  }

  async function returnLine(lineId: number) {
    await supabase.rpc('return_part_line', { p_line_id: lineId })
    load()
  }

  async function createInvoice() {
    if (!ticket) return
    const { data, error } = await supabase.rpc('create_invoice_from_ticket', { p_ticket_id: ticket.id })
    if (error) {
      toast(error.message)
      return
    }
    bump()
    navigate(`/invoices/${data}`)
  }

  if (!ticket) return null

  const contactLine = [customer?.contact, customer?.phone, customer?.email].filter(Boolean).join('  ·  ')

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr minmax(320px, 1fr)', gap: 32 }}>
      <div>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Job board
        </Button>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: 8 }}>
          <div>
            <div className="kicker">
              {ticket.id} · opened {new Date(ticket.opened_at).toLocaleDateString()}
            </div>
            <h2 style={{ margin: 0 }}>{customer?.name ?? 'Unknown customer'}</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              {contactLine}
            </div>
          </div>
          <div style={{ fontSize: 28, fontFamily: 'var(--font-heading)', fontWeight: 800 }}>{money(grand)}</div>
        </div>

        <hr className="hr" />

        <div style={{ marginBottom: 16 }}>
          <div className="kicker" style={{ marginBottom: 6 }}>
            Stage
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {STAGES.map((s) => {
              const active = ticket.status === s.key
              return (
                <button
                  key={s.key}
                  className="btn"
                  style={{
                    background: active ? 'var(--color-accent)' : 'transparent',
                    color: active ? 'var(--color-bg)' : undefined,
                    border: active ? 'none' : '1px solid var(--color-divider)',
                  }}
                  onClick={() => saveTicket({ status: s.key })}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
          <Field label="Make">
            <Input defaultValue={ticket.make ?? ''} onBlur={(e) => saveTicket({ make: e.target.value })} />
          </Field>
          <Field label="Model">
            <Input defaultValue={ticket.model ?? ''} onBlur={(e) => saveTicket({ model: e.target.value })} />
          </Field>
          <Field label="Serial no.">
            <Input defaultValue={ticket.serial ?? ''} onBlur={(e) => saveTicket({ serial: e.target.value })} />
          </Field>
          <Field label="Tech assigned">
            <Select value={ticket.tech_id ?? ''} onChange={(e) => saveTicket({ tech_id: e.target.value || null })}>
              <option value="">—</option>
              {techs.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Warranty / insurance">
            <Select value={ticket.warranty} onChange={(e) => saveTicket({ warranty: e.target.value as Warranty })}>
              <option value="none">Billable — customer pays</option>
              <option value="warranty">Warranty claim</option>
              <option value="insurance">Insurance claim</option>
            </Select>
          </Field>
          <Field label="Claim / PO number">
            <Input defaultValue={ticket.claim ?? ''} onBlur={(e) => saveTicket({ claim: e.target.value })} />
          </Field>
        </div>

        <Field label="Reported issue">
          <Textarea defaultValue={ticket.issue ?? ''} onBlur={(e) => saveTicket({ issue: e.target.value })} />
        </Field>
        <Field label="Tech notes">
          <Textarea
            style={{ minHeight: 70 }}
            defaultValue={ticket.notes ?? ''}
            onBlur={(e) => saveTicket({ notes: e.target.value })}
          />
        </Field>
      </div>

      <div>
        <h5>Labor</h5>
        <table className="table">
          <thead>
            <tr>
              <th>Work performed</th>
              <th>Hrs</th>
              <th>Rate</th>
              <th>Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {labor.map((l) => (
              <tr key={l.id}>
                <td>{l.description}</td>
                <td>{l.hours}</td>
                <td>{money(l.rate)}</td>
                <td>{money(l.hours * l.rate)}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => removeLabor(l.id)}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: 8, marginTop: 8 }}>
          <Input placeholder="Replace front left arm assembly" value={laborDesc} onChange={(e) => setLaborDesc(e.target.value)} />
          <Input placeholder="Hrs" value={laborHours} onChange={(e) => setLaborHours(e.target.value)} />
          <Input placeholder="Rate" value={laborRate} onChange={(e) => setLaborRate(e.target.value)} />
          <Button variant="secondary" onClick={addLabor}>
            Add
          </Button>
        </div>

        <h5 style={{ marginTop: 24 }}>Parts pulled from inventory — {partsCount} items</h5>
        <table className="table">
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
            {partLines.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td>{p.sku ? `${p.sku} — ${p.name}` : p.name}</td>
                  <td>{p.qty}</td>
                  <td>{money(p.price)}</td>
                  <td>{money(p.qty * p.price)}</td>
                  <td>
                    <button className="btn btn-ghost" title="Return to stock" onClick={() => returnLine(p.id)}>
                      ×
                    </button>
                  </td>
                </tr>
                {p.kit && (
                  <tr>
                    <td colSpan={5} style={{ paddingLeft: 20, borderLeft: '2px solid var(--color-divider)', fontSize: 12 }}>
                      Includes:{' '}
                      {p.kit.map((k) => `${k.qty} × ${k.sku}  ${k.name}`).join(', ')}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>

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
            <option value="">All sections ({scopedParts.length})</option>
            {sections.map(([cat, count]) => (
              <option key={cat} value={cat}>
                {cat} ({count})
              </option>
            ))}
          </Select>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginTop: 8 }}>
          <Input
            list="part-lookup"
            placeholder={`Search ${scopedParts.length} items…`}
            value={skuText}
            onChange={(e) => setSkuText(e.target.value)}
          />
          <datalist id="part-lookup">
            {scopedParts.slice(0, 60).map((p) => (
              <option key={p.sku} value={`${p.sku} — ${p.name}`}>
                {p.category === 'Service' ? `service, ${money(p.price)}` : `${p.qty_on_hand} on hand, ${money(p.price)}`}
              </option>
            ))}
          </datalist>
          <Input value={pullQty} onChange={(e) => setPullQty(e.target.value)} />
          <Button variant="secondary" onClick={pullPart}>
            Pull
          </Button>
        </div>
        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
          Pulling a part decrements on-hand stock immediately.
        </div>

        {bundles.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginTop: 8 }}>
            <Select value={bundlePick} onChange={(e) => setBundlePick(e.target.value)}>
              <option value="">Add a bundle…</option>
              {bundles.map((b) => (
                <option key={b.bundle_id} value={b.bundle_id}>
                  {b.name} — {money(b.retail_total)}
                </option>
              ))}
            </Select>
            <Input value={bundleQty} onChange={(e) => setBundleQty(e.target.value)} />
            <Button variant="secondary" onClick={pullBundle}>
              Pull kit
            </Button>
          </div>
        )}
        {flash && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 6 }}>{flash}</div>}

        <div style={{ borderTop: '2px solid var(--color-divider)', marginTop: 20, paddingTop: 12 }}>
          <Row label="Labor" value={money(laborTotal)} />
          <Row label="Parts" value={money(partsTotal)} />
          <Row label={`Tax (${taxable ? `${(settings.tax_rate * 100).toFixed(1)}%` : 'exempt'})`} value={taxable ? money(tax) : 'exempt'} />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 22, fontWeight: 800, marginTop: 8 }}>
            <span>Total</span>
            <span>{money(grand)}</span>
          </div>
          {invoiceId ? (
            <Button variant="secondary" block onClick={() => navigate(`/invoices/${invoiceId}`)}>
              View invoice {invoiceId}
            </Button>
          ) : (
            <Button variant="primary" block onClick={createInvoice}>
              Create invoice &amp; move to Invoiced
            </Button>
          )}
        </div>
      </div>
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
