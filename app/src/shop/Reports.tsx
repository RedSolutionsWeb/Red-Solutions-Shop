import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useShopSettings } from '../lib/useShopSettings'
import type { Invoice, LaborLine, PartLine, Profile, Ticket } from '../lib/types'
import { money } from '../lib/money'

export function Reports() {
  const settings = useShopSettings()
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [labor, setLabor] = useState<LaborLine[]>([])
  const [partLines, setPartLines] = useState<PartLine[]>([])
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])

  useEffect(() => {
    async function load() {
      const [invRes, laborRes, partsRes, ticketsRes, profRes] = await Promise.all([
        supabase.from('invoices').select('*').is('voided_at', null),
        supabase.from('labor_lines').select('*'),
        supabase.from('part_lines').select('*'),
        supabase.from('tickets').select('*').is('deleted_at', null),
        supabase.from('profiles').select('*'),
      ])
      const liveTickets = (ticketsRes.data as Ticket[]) ?? []
      const liveTicketIds = new Set(liveTickets.map((t) => t.id))
      setInvoices((invRes.data as Invoice[]) ?? [])
      setLabor(((laborRes.data as LaborLine[]) ?? []).filter((l) => liveTicketIds.has(l.ticket_id)))
      setPartLines(((partsRes.data as PartLine[]) ?? []).filter((p) => liveTicketIds.has(p.ticket_id)))
      setTickets(liveTickets)
      setProfiles((profRes.data as Profile[]) ?? [])
    }
    load()
  }, [])

  const billedAllTime = invoices.reduce((s, i) => s + i.total, 0)
  const ticketInvoices = invoices.filter((i) => i.ticket_id)
  const avgTicket = ticketInvoices.length ? billedAllTime / ticketInvoices.length : 0
  const laborHours = labor.reduce((s, l) => s + Number(l.hours), 0)
  const partsRevenue = partLines.reduce((s, p) => s + p.qty * p.price, 0)

  const byMonth = new Map<string, number>()
  for (const inv of invoices) {
    const key = inv.date.slice(0, 7)
    byMonth.set(key, (byMonth.get(key) ?? 0) + inv.total)
  }
  const months = Array.from(byMonth.entries()).sort(([a], [b]) => (a < b ? -1 : 1))
  const maxMonth = Math.max(1, ...months.map(([, v]) => v))

  const partsAgg = new Map<string, { name: string; used: number; revenue: number }>()
  for (const p of partLines) {
    const key = p.sku ?? p.name
    const cur = partsAgg.get(key) ?? { name: p.name, used: 0, revenue: 0 }
    cur.used += p.qty
    cur.revenue += p.qty * p.price
    partsAgg.set(key, cur)
  }
  const partsTop = Array.from(partsAgg.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 6)

  const salesAgg = new Map<string, { name: string; count: number; billed: number }>()
  for (const inv of invoices) {
    const key = inv.rep ?? 'unassigned'
    const name = inv.rep ? profiles.find((p) => p.id === inv.rep)?.name ?? inv.rep : 'Unassigned'
    const cur = salesAgg.get(key) ?? { name, count: 0, billed: 0 }
    cur.count += 1
    cur.billed += inv.total
    salesAgg.set(key, cur)
  }
  const salesRows = Array.from(salesAgg.values()).sort((a, b) => b.billed - a.billed)

  const ticketById = Object.fromEntries(tickets.map((t) => [t.id, t]))
  const techAgg = new Map<string, { name: string; hours: number; billed: number }>()
  for (const l of labor) {
    const t = ticketById[l.ticket_id]
    const techId = t?.tech_id ?? 'unassigned'
    const name = t?.tech_id ? profiles.find((p) => p.id === t.tech_id)?.name ?? 'Unknown' : 'Unassigned'
    const cur = techAgg.get(techId) ?? { name, hours: 0, billed: 0 }
    cur.hours += Number(l.hours)
    cur.billed += Number(l.hours) * Number(l.rate)
    techAgg.set(techId, cur)
  }
  const techRows = Array.from(techAgg.values())

  return (
    <div>
      <h2 style={{ margin: 0 }}>Reports</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid var(--color-divider)',
          margin: '16px 0',
        }}
      >
        <Kpi label="Billed, all time" value={money(billedAllTime)} note={`${invoices.length} invoices`} />
        <Kpi label="Avg. repair ticket" value={money(avgTicket)} note="labor + parts + tax" />
        <Kpi label="Labor hours logged" value={laborHours.toFixed(1)} note={`at ${money(settings.labor_rate)}/hr default`} />
        <Kpi label="Parts revenue" value={money(partsRevenue)} note="pulled from stock" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        <div>
          <h5>Billed by month</h5>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {months.map(([m, v]) => (
              <div key={m} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 60 }}>{m}</span>
                <div style={{ flex: 1, background: 'var(--color-surface)' }}>
                  <div style={{ width: `${(v / maxMonth) * 100}%`, background: 'var(--color-accent)', height: 16 }} />
                </div>
                <span>{money(v)}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h5>Parts consumed (open + closed jobs)</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Part</th>
                  <th>Used</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {partsTop.map((p) => (
                  <tr key={p.name}>
                    <td>{p.name}</td>
                    <td>{p.used}</td>
                    <td>{money(p.revenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5>Sales by salesman</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Salesman</th>
                  <th>Invoices</th>
                  <th>Billed</th>
                </tr>
              </thead>
              <tbody>
                {salesRows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.count}</td>
                    <td>{money(r.billed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h5>Labor hours by tech</h5>
            <table className="table">
              <thead>
                <tr>
                  <th>Tech</th>
                  <th>Hrs</th>
                  <th>Billed</th>
                </tr>
              </thead>
              <tbody>
                {techRows.map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td>{r.hours.toFixed(1)}</td>
                    <td>{money(r.billed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function Kpi({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div style={{ padding: 16, borderRight: '1px solid var(--color-divider)' }}>
      <div className="kicker">{label}</div>
      <div style={{ fontFamily: 'var(--font-heading)', fontWeight: 800, fontSize: 24 }}>{value}</div>
      <div className="muted" style={{ fontSize: 12 }}>
        {note}
      </div>
    </div>
  )
}
