import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useShopSettings } from '../lib/useShopSettings'
import { useReload } from './ReloadContext'
import { useToast } from '../ui/Toast'
import type { PartView } from '../lib/types'
import { costOrUnknown, marginPct, money } from '../lib/money'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { Dialog } from '../ui/Dialog'

export function Inventory() {
  const { identity } = useAuth()
  const settings = useShopSettings()
  const { bump } = useReload()
  const toast = useToast()
  const isOwner = identity?.kind === 'staff' && identity.profile.role === 'owner'

  const [parts, setParts] = useState<PartView[]>([])
  const [search, setSearch] = useState('')
  const [lowOnly, setLowOnly] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [drawerSku, setDrawerSku] = useState<string | null>(null)
  const [csvOpen, setCsvOpen] = useState(false)

  async function load() {
    const { data } = await supabase.from('parts_view').select('*').order('sku')
    setParts((data as PartView[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const q = search.trim().toLowerCase()
  let rows = parts.filter((p) => {
    if (q && !(`${p.sku} ${p.name} ${p.category}`.toLowerCase().includes(q))) return false
    if (lowOnly && !(p.category !== 'Service' && p.qty_on_hand <= settings.low_stock_threshold)) return false
    return true
  })
  const totalMatches = rows.length
  const capped = rows.slice(0, 120)

  const skuCount = parts.length
  const unitsOnHand = parts.filter((p) => p.category !== 'Service').reduce((s, p) => s + p.qty_on_hand, 0)
  const stockValue = parts
    .filter((p) => p.category !== 'Service')
    .reduce((s, p) => s + p.qty_on_hand * (p.cost ?? 0), 0)
  const lowCount = parts.filter((p) => p.category !== 'Service' && p.qty_on_hand <= settings.low_stock_threshold).length

  async function loadCatalog() {
    toast('Catalog is already loaded on the server — new SKUs merge automatically.')
  }

  function exportCsv() {
    const header = 'sku,name,category,qty,cost,price'
    const lines = parts.map((p) => [p.sku, p.name, p.category, p.qty_on_hand, p.cost ?? '', p.price].join(','))
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'redsolutions-stock.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <h2 style={{ margin: 0 }}>Inventory</h2>

      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', margin: '16px 0' }}>
        <Field label="Search SKU, part or category">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} style={{ minWidth: 260 }} />
        </Field>
        <Button variant={lowOnly ? 'primary' : 'secondary'} onClick={() => setLowOnly((v) => !v)}>
          {lowOnly ? 'Showing low stock only' : 'Show low stock only'}
        </Button>
        <Button variant="primary" onClick={() => setAddOpen(true)}>
          Add item
        </Button>
        <Button variant="secondary" onClick={() => setCsvOpen(true)}>
          Bulk upload parts (CSV)
        </Button>
        <Button variant="secondary" onClick={exportCsv}>
          Export stock CSV
        </Button>
        <Button variant="ghost" onClick={loadCatalog}>
          Load Red Solutions catalog
        </Button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid var(--color-divider)',
          marginBottom: 16,
        }}
      >
        <Kpi label="SKUs" value={skuCount} />
        <Kpi label="Units on hand" value={unitsOnHand} />
        <Kpi label="Stock value at cost" value={money(stockValue)} />
        <Kpi label="Low stock" value={lowCount} accent={lowCount > 0} />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>SKU</th>
            <th>Part</th>
            <th>Category</th>
            <th>On hand</th>
            {isOwner && <th>Cost</th>}
            <th>Retail</th>
            {isOwner && <th>Margin</th>}
            <th />
          </tr>
        </thead>
        <tbody>
          {capped.map((p) => {
            const low = p.category !== 'Service' && p.qty_on_hand <= settings.low_stock_threshold
            const catCell =
              p.fits.length && p.fits[0] !== 'All' ? `${p.fits.join(' / ')} · ${p.category}` : p.category
            return (
              <tr key={p.sku} style={{ cursor: 'pointer' }} onClick={() => setDrawerSku(p.sku)}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{catCell}</td>
                <td style={{ color: low ? 'var(--color-accent)' : undefined }}>
                  {p.category === 'Service' ? '—' : p.qty_on_hand}
                </td>
                {isOwner && <td>{costOrUnknown(p.cost)}</td>}
                <td>{money(p.price)}</td>
                {isOwner && <td>{marginPct(p.price, p.cost)}</td>}
                <td>
                  <button className="btn btn-ghost" onClick={(e) => (e.stopPropagation(), setDrawerSku(p.sku))}>
                    Edit
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {capped.length === 0 && <div className="muted" style={{ padding: 16 }}>No parts match that search.</div>}
      {totalMatches > 120 && (
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          Showing 120 of {totalMatches} — narrow the search to see the rest.
        </div>
      )}

      {addOpen && (
        <AddItemDialog
          isOwner={isOwner}
          existing={parts}
          onClose={() => setAddOpen(false)}
          onAdded={(sku) => {
            setAddOpen(false)
            toast(`${sku} added to inventory`)
            load()
            bump()
          }}
        />
      )}
      {drawerSku && (
        <PartDrawer
          sku={drawerSku}
          isOwner={isOwner}
          onClose={() => setDrawerSku(null)}
          onSaved={() => {
            load()
            bump()
          }}
        />
      )}
      {csvOpen && (
        <CsvUploadDialog
          onClose={() => setCsvOpen(false)}
          onDone={(msg) => {
            setCsvOpen(false)
            toast(msg)
            load()
            bump()
          }}
        />
      )}
    </div>
  )
}

function Kpi({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div style={{ padding: 16, borderRight: '1px solid var(--color-divider)' }}>
      <div className="kicker">{label}</div>
      <div
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: 26,
          color: accent ? 'var(--color-accent)' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}

function AddItemDialog({
  isOwner,
  existing,
  onClose,
  onAdded,
}: {
  isOwner: boolean
  existing: PartView[]
  onClose: () => void
  onAdded: (sku: string) => void
}) {
  const [sku, setSku] = useState('')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [qty, setQty] = useState('0')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [error, setError] = useState('')

  async function submit() {
    if (!sku.trim() || !name.trim()) {
      setError('SKU and name are both required.')
      return
    }
    if (existing.some((p) => p.sku === sku.trim())) {
      setError(`${sku} already exists.`)
      return
    }
    const { error: err } = await supabase.from('parts').insert({
      sku: sku.trim(),
      name: name.trim(),
      category,
      qty_on_hand: Number(qty) || 0,
      cost: isOwner ? Number(cost) || 0 : 0,
      price: Number(price) || 0,
    })
    if (err) {
      setError(err.message)
      return
    }
    onAdded(sku.trim())
  }

  const categories = Array.from(new Set(existing.map((p) => p.category).filter(Boolean))) as string[]

  return (
    <Dialog
      title="Add an inventory item"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add item
          </Button>
        </>
      }
    >
      <p>Anything you sell — a part, a generator, a trailer, a service — goes here and can then be pulled onto a ticket or a bundle.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="SKU">
          <Input placeholder="GEN-7500" value={sku} onChange={(e) => setSku(e.target.value)} />
        </Field>
        <Field label="Name">
          <Input placeholder="7500W tri-fuel generator" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <Input list="cat-lookup" placeholder="Generator" value={category} onChange={(e) => setCategory(e.target.value)} />
          <datalist id="cat-lookup">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="On hand">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        {isOwner && (
          <Field label="Unit cost">
            <Input placeholder="optional" value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Field label="Retail price">
          <Input value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
      </div>
      {error && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 8 }}>{error}</div>}
    </Dialog>
  )
}

function PartDrawer({
  sku,
  isOwner,
  onClose,
  onSaved,
}: {
  sku: string
  isOwner: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [part, setPart] = useState<PartView | null>(null)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [qty, setQty] = useState('')
  const [cost, setCost] = useState('')
  const [price, setPrice] = useState('')
  const [receive, setReceive] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    supabase
      .from('parts_view')
      .select('*')
      .eq('sku', sku)
      .single()
      .then(({ data }) => {
        const p = data as PartView
        setPart(p)
        setName(p.name)
        setCategory(p.category ?? '')
        setQty(String(p.qty_on_hand))
        setCost(p.cost ? String(p.cost) : '')
        setPrice(String(p.price))
      })
  }, [sku])

  async function save() {
    const patch: Record<string, unknown> = {
      name,
      category,
      qty_on_hand: Number(qty) || 0,
      price: Number(price) || 0,
    }
    if (isOwner) patch.cost = Number(cost) || 0
    await supabase.from('parts').update(patch).eq('sku', sku)
    onSaved()
    onClose()
  }

  async function doReceive() {
    const n = Number(receive)
    if (!n || n <= 0) {
      setError('Enter a quantity to receive')
      return
    }
    await supabase
      .from('parts')
      .update({ qty_on_hand: (Number(qty) || 0) + n })
      .eq('sku', sku)
    setReceive('')
    onSaved()
    setQty(String((Number(qty) || 0) + n))
  }

  async function del() {
    await supabase.from('parts').delete().eq('sku', sku)
    onSaved()
    onClose()
  }

  if (!part) return null

  return (
    <Dialog
      title={part.name}
      onClose={onClose}
      actions={
        <>
          {isOwner && (
            <Button variant="ghost" onClick={del}>
              Delete part
            </Button>
          )}
          <Button variant="primary" onClick={save} style={{ marginLeft: 'auto' }}>
            Done
          </Button>
        </>
      }
    >
      <div className="kicker">
        {sku} · {part.category}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
        <Field label="Item name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Category">
          <Input value={category} onChange={(e) => setCategory(e.target.value)} />
        </Field>
        <Field label="On hand">
          <Input value={qty} onChange={(e) => setQty(e.target.value)} />
        </Field>
        {isOwner && (
          <Field label="Unit cost">
            <Input value={cost} onChange={(e) => setCost(e.target.value)} />
          </Field>
        )}
        <Field label="Retail price">
          <Input value={price} onChange={(e) => setPrice(e.target.value)} disabled={!isOwner} />
        </Field>
        <Field label="Receive stock (add to on hand)">
          <div style={{ display: 'flex', gap: 8 }}>
            <Input value={receive} onChange={(e) => setReceive(e.target.value)} />
            <Button variant="secondary" onClick={doReceive}>
              Receive
            </Button>
          </div>
        </Field>
        {error && <div style={{ color: 'var(--color-accent)', fontSize: 12 }}>{error}</div>}
        {isOwner && Number(cost) > 0 && (
          <div className="muted" style={{ fontSize: 12 }}>
            margin {marginPct(Number(price), Number(cost))} · stock value {money(Number(qty) * Number(cost))}
          </div>
        )}
      </div>
    </Dialog>
  )
}

function CsvUploadDialog({ onClose, onDone }: { onClose: () => void; onDone: (msg: string) => void }) {
  const [text, setText] = useState('')

  async function importCsv() {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
    let added = 0
    let updated = 0
    let skipped = 0
    for (const line of lines) {
      const cols = line.split(',').map((c) => c.trim())
      if (/sku/i.test(cols[0])) continue
      const [sku, name, category, qty, cost, price] = cols
      if (!sku) {
        skipped++
        continue
      }
      const { data: exists } = await supabase.from('parts').select('sku').eq('sku', sku).maybeSingle()
      const row = {
        sku,
        name: name || sku,
        category: category || null,
        qty_on_hand: Number(qty) || 0,
        cost: Number(cost) || 0,
        price: Number(price) || 0,
      }
      if (exists) {
        await supabase.from('parts').update(row).eq('sku', sku)
        updated++
      } else {
        await supabase.from('parts').insert(row)
        added++
      }
    }
    onDone(`${added} parts added, ${updated} updated${skipped ? `, ${skipped} skipped` : ''}`)
  }

  return (
    <Dialog
      title="Bulk upload parts"
      onClose={onClose}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={importCsv}>
            Import parts
          </Button>
        </>
      }
    >
      <p>
        Upload or paste a CSV with the columns <strong>sku, name, category, qty, cost, price</strong>. Existing SKUs
        are updated, new ones are added.
      </p>
      <input
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (!file) return
          file.text().then(setText)
        }}
      />
      <textarea
        className="input"
        style={{ minHeight: 140, marginTop: 8 }}
        placeholder={'sku,name,category,qty,cost,price\nP-9450,Propeller pair 9450,Airframe,40,3.80,11.00'}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
    </Dialog>
  )
}
