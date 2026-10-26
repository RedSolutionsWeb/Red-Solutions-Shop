import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useReload } from './ReloadContext'
import type { BundlePricing, PartView } from '../lib/types'
import { money } from '../lib/money'
import { Button } from '../ui/Button'
import { Input } from '../ui/Field'

export function Bundles() {
  const { bump } = useReload()
  const [bundles, setBundles] = useState<BundlePricing[]>([])
  const [parts, setParts] = useState<PartView[]>([])
  const [selected, setSelected] = useState<number | null>(null)
  const [name, setName] = useState('')
  const [sku, setSku] = useState('')
  const [flash, setFlash] = useState('')
  const [compSku, setCompSku] = useState('')
  const [compQty, setCompQty] = useState('1')

  async function load() {
    const [b, p] = await Promise.all([
      supabase.from('bundle_pricing').select('*').order('name'),
      supabase.from('parts_view').select('*'),
    ])
    setBundles((b.data as BundlePricing[]) ?? [])
    setParts((p.data as PartView[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function createBundle() {
    if (!name.trim()) {
      setFlash('Name the bundle first')
      return
    }
    const nextNum = bundles.length + 1
    const genSku = sku.trim() || `KIT-${String(nextNum).padStart(3, '0')}`
    const { data, error } = await supabase.from('bundles').insert({ name: name.trim(), sku: genSku }).select().single()
    if (error) {
      setFlash(error.message)
      return
    }
    setName('')
    setSku('')
    setSelected(data.id)
    load()
    bump()
  }

  async function deleteBundle(id: number) {
    await supabase.from('bundles').delete().eq('id', id)
    if (selected === id) setSelected(null)
    load()
    bump()
  }

  function resolvePart(text: string): PartView | null {
    const raw = text.trim().toLowerCase()
    if (!raw) return null
    const exact = parts.find((p) => p.sku.toLowerCase() === raw)
    if (exact) return exact
    const tokens = raw.split(/[\s,()-]+/).filter(Boolean)
    const matches = parts.filter((p) => tokens.every((t) => `${p.sku} ${p.name}`.toLowerCase().includes(t)))
    if (matches.length === 1) return matches[0]
    setFlash(matches.length === 0 ? 'No part matches that' : `${matches.length} parts match — pick one from the list`)
    return null
  }

  async function addComponent() {
    if (!selected) return
    const part = resolvePart(compSku)
    if (!part) return
    await supabase
      .from('bundle_lines')
      .upsert({ bundle_id: selected, sku: part.sku, qty: Number(compQty) || 1 })
    setCompSku('')
    setCompQty('1')
    load()
  }

  async function removeComponent(bundleId: number, partSku: string) {
    await supabase.from('bundle_lines').delete().eq('bundle_id', bundleId).eq('sku', partSku)
    load()
  }

  const current = bundles.find((b) => b.bundle_id === selected)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
      <div>
        <h2 style={{ margin: 0 }}>Bundles</h2>
        <p className="muted">
          A bundle bills as one line at the sum of its components' retail. Pulling one on a job consumes every
          component from stock.
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>Bundle</th>
              <th>SKU</th>
              <th>Items</th>
              <th>Retail</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bundles.map((b) => (
              <tr key={b.bundle_id} style={{ cursor: 'pointer' }} onClick={() => setSelected(b.bundle_id)}>
                <td>{b.name}</td>
                <td>{b.sku}</td>
                <td>{b.components?.length ?? 0}</td>
                <td>{money(b.retail_total)}</td>
                <td>
                  <button className="btn btn-ghost" onClick={(e) => {
                    e.stopPropagation()
                    deleteBundle(b.bundle_id)
                  }}>
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {bundles.length === 0 && <div className="muted" style={{ padding: 16 }}>No bundles yet. Name one to start.</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginTop: 12 }}>
          <Input placeholder="HD580 arm rebuild" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="KIT-001" value={sku} onChange={(e) => setSku(e.target.value)} />
          <Button variant="secondary" onClick={createBundle}>
            Create
          </Button>
        </div>
        {flash && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 6 }}>{flash}</div>}
      </div>

      {current && (
        <div>
          <h5 style={{ marginBottom: 0 }}>{current.name}</h5>
          <div style={{ fontSize: 20, fontWeight: 800 }}>{money(current.retail_total)}</div>
          <div className="kicker">{current.sku}</div>
          <hr className="hr" />
          <table className="table">
            <thead>
              <tr>
                <th>Component</th>
                <th>Qty</th>
                <th>Retail</th>
                <th>Amount</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {(current.components ?? []).map((c) => (
                <tr key={c.sku}>
                  <td>{c.name}</td>
                  <td>{c.qty}</td>
                  <td>{money(c.price)}</td>
                  <td>{money(c.qty * c.price)}</td>
                  <td>
                    <button className="btn btn-ghost" onClick={() => removeComponent(current.bundle_id, c.sku)}>
                      ×
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(current.components ?? []).length === 0 && (
            <div className="muted" style={{ padding: 16 }}>
              No components yet.
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 8, marginTop: 8 }}>
            <Input
              list="bundle-part-lookup"
              placeholder="Type a SKU or part name…"
              value={compSku}
              onChange={(e) => setCompSku(e.target.value)}
            />
            <datalist id="bundle-part-lookup">
              {parts.slice(0, 60).map((p) => (
                <option key={p.sku} value={`${p.sku} — ${p.name}`} />
              ))}
            </datalist>
            <Input value={compQty} onChange={(e) => setCompQty(e.target.value)} />
            <Button variant="secondary" onClick={addComponent}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
