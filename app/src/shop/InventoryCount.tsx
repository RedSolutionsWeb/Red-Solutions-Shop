import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useToast } from '../ui/Toast'
import type { InventoryCount, InventoryCountLine, PartView, Profile } from '../lib/types'
import { Button } from '../ui/Button'
import { Select } from '../ui/Field'
import { Tag } from '../ui/Tag'

const AIRCRAFT = [
  { key: '', label: 'All aircraft' },
  { key: 'HD580', label: 'Vector HD580' },
  { key: 'C31', label: 'Ceres Air C31' },
]

export function InventoryCounts() {
  const navigate = useNavigate()
  const [counts, setCounts] = useState<InventoryCount[]>([])
  const [busy, setBusy] = useState(false)

  async function load() {
    const { data } = await supabase.from('inventory_counts').select('*').order('started_at', { ascending: false })
    setCounts((data as InventoryCount[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  async function startOrResume() {
    setBusy(true)
    const { data, error } = await supabase.rpc('start_inventory_count')
    setBusy(false)
    if (error) return
    navigate(`/counts/${data}`)
  }

  const statusTag = (s: InventoryCount['status']) =>
    s === 'open' ? (
      <Tag variant="outline">In progress</Tag>
    ) : s === 'completed' ? (
      <Tag variant="accent">Needs review</Tag>
    ) : (
      <Tag variant="neutral">Applied</Tag>
    )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Inventory count</h2>
        <Button variant="primary" onClick={startOrResume} disabled={busy}>
          Start / resume count
        </Button>
      </div>
      <p className="muted" style={{ marginTop: 4 }}>
        Walk the shelf and enter what you actually have. Finishing a count shows the difference against the
        system and QuickBooks before anything changes.
      </p>

      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Started</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {counts.map((c) => (
            <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/counts/${c.id}`)}>
              <td>{new Date(c.started_at).toLocaleString()}</td>
              <td>{statusTag(c.status)}</td>
              <td>
                <button className="btn btn-ghost">Open</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {counts.length === 0 && <div className="muted" style={{ padding: 16 }}>No counts yet.</div>}
    </div>
  )
}

export function InventoryCountDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { identity } = useAuth()
  const toast = useToast()
  const role = identity?.kind === 'staff' ? identity.profile.role : null
  const isManager = role === 'owner' || role === 'sales'

  const [count, setCount] = useState<InventoryCount | null>(null)
  const [lines, setLines] = useState<InventoryCountLine[]>([])
  const [parts, setParts] = useState<PartView[]>([])
  const [profiles, setProfiles] = useState<Record<string, Profile>>({})
  const [aircraft, setAircraft] = useState('')
  const [section, setSection] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    if (!id) return
    const [{ data: c }, { data: ls }, { data: ps }, { data: profs }] = await Promise.all([
      supabase.from('inventory_counts').select('*').eq('id', id).single(),
      supabase.from('inventory_count_lines').select('*').eq('count_id', id),
      supabase.from('parts_view').select('*').order('sku'),
      supabase.from('profiles').select('*'),
    ])
    setCount(c as InventoryCount)
    setLines((ls as InventoryCountLine[]) ?? [])
    setParts((ps as PartView[]) ?? [])
    setProfiles(Object.fromEntries(((profs as Profile[]) ?? []).map((p) => [p.id, p])))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const lineBySku = useMemo(() => Object.fromEntries(lines.map((l) => [l.sku, l])), [lines])

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

  async function saveCount(sku: string, value: string) {
    if (!id) return
    const qty = Number(value)
    if (!Number.isFinite(qty) || qty < 0) return
    const { error: err } = await supabase.rpc('count_line_upsert', { p_count_id: Number(id), p_sku: sku, p_qty: Math.floor(qty) })
    if (err) {
      setError(err.message)
      return
    }
    setError('')
    load()
  }

  async function finishCount() {
    if (!id) return
    setBusy(true)
    const { error: err } = await supabase.rpc('complete_inventory_count', { p_count_id: Number(id) })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    load()
  }

  async function applyCount() {
    if (!id) return
    setBusy(true)
    const { error: err } = await supabase.rpc('apply_inventory_count', { p_count_id: Number(id) })
    setBusy(false)
    if (err) {
      setError(err.message)
      return
    }
    toast('Counts applied to inventory')
    load()
  }

  if (!count) return null

  if (count.status !== 'open') {
    const uncounted = parts.length - lines.length
    const mismatched = lines.filter((l) => l.counted_qty !== l.system_qty)
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate('/counts')}>
          ← Inventory count
        </Button>
        <div className="card elev-md" style={{ marginTop: 16, padding: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>
              Count from {new Date(count.started_at).toLocaleDateString()}
            </h3>
            {count.status === 'completed' && isManager && (
              <Button variant="primary" onClick={applyCount} disabled={busy}>
                Apply to inventory
              </Button>
            )}
            {count.status === 'applied' && <Tag variant="neutral">Applied {new Date(count.applied_at!).toLocaleString()}</Tag>}
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {lines.length} parts counted, {uncounted} not counted, {mismatched.length} don't match the system.
          </p>

          <table className="table" style={{ marginTop: 12 }}>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Part</th>
                <th>System</th>
                <th>QuickBooks</th>
                <th>Counted</th>
                <th>Diff vs system</th>
                <th>Diff vs QBO</th>
                <th>By</th>
              </tr>
            </thead>
            <tbody>
              {[...lines]
                .sort((a, b) => Math.abs(b.counted_qty - b.system_qty) - Math.abs(a.counted_qty - a.system_qty))
                .map((l) => {
                  const part = parts.find((p) => p.sku === l.sku)
                  const diffSystem = l.counted_qty - l.system_qty
                  const diffQbo = l.qbo_qty !== null ? l.counted_qty - l.qbo_qty : null
                  return (
                    <tr key={l.id}>
                      <td>{l.sku}</td>
                      <td>{part?.name ?? l.sku}</td>
                      <td>{l.system_qty}</td>
                      <td>{l.qbo_qty ?? '—'}</td>
                      <td>{l.counted_qty}</td>
                      <td style={{ color: diffSystem !== 0 ? 'var(--color-accent)' : undefined, fontWeight: diffSystem !== 0 ? 700 : 400 }}>
                        {diffSystem > 0 ? `+${diffSystem}` : diffSystem}
                      </td>
                      <td style={{ color: diffQbo && diffQbo !== 0 ? 'var(--color-accent)' : undefined, fontWeight: diffQbo && diffQbo !== 0 ? 700 : 400 }}>
                        {diffQbo === null ? '—' : diffQbo > 0 ? `+${diffQbo}` : diffQbo}
                      </td>
                      <td style={{ fontSize: 12 }}>{l.counted_by ? profiles[l.counted_by]?.name ?? '' : ''}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
          <p className="muted" style={{ fontSize: 11, marginTop: 12 }}>
            {lines.some((l) => l.qbo_qty !== null)
              ? 'QuickBooks quantities shown are from the last automatic sync, not live.'
              : 'No QuickBooks quantities were synced yet when this count ran — the QBO column will stay blank until the first quantity sync.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Button variant="ghost" onClick={() => navigate('/counts')}>
        ← Inventory count
      </Button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
        <h2 style={{ margin: 0 }}>Counting — {lines.length} of {parts.length} done</h2>
        <Button variant="primary" onClick={finishCount} disabled={busy}>
          Finish count
        </Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
        <Select value={aircraft} onChange={(e) => { setAircraft(e.target.value); setSection('') }}>
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

      {error && <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 8 }}>{error}</div>}

      <table className="table" style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Part</th>
            <th>System qty</th>
            <th>Counted</th>
          </tr>
        </thead>
        <tbody>
          {scopedParts.map((p) => {
            const line = lineBySku[p.sku]
            return (
              <tr key={p.sku}>
                <td>{p.sku}</td>
                <td>{p.name}</td>
                <td>{p.qty_on_hand}</td>
                <td>
                  <input
                    className="input"
                    style={{ width: 90 }}
                    type="number"
                    min={0}
                    defaultValue={line ? line.counted_qty : ''}
                    key={line ? `${p.sku}-${line.counted_qty}` : p.sku}
                    onBlur={(e) => e.target.value !== '' && saveCount(p.sku, e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                  />
                  {line && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--color-accent)' }}>saved</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
