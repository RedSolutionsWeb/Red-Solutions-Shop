import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money } from '../lib/money'
import type { Customer, Invoice, LaborLine, PartLine, Ticket, Warranty } from '../lib/types'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { Logo } from '../ui/Logo'

const WARRANTY_LABEL: Record<Warranty, string> = { none: 'Billable', warranty: 'Warranty', insurance: 'Insurance' }

function normalize(serial: string) {
  return serial.trim().toUpperCase()
}

interface ServiceEvent {
  ticket: Ticket
  customerName: string
  labor: LaborLine[]
  parts: PartLine[]
  invoice: Invoice | null
}

export function DroneHistory() {
  const [searchParams] = useSearchParams()
  const [query, setQuery] = useState(searchParams.get('serial') ?? '')
  const [candidates, setCandidates] = useState<{ serial: string; make: string | null; model: string | null }[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [events, setEvents] = useState<ServiceEvent[]>([])
  const [loading, setLoading] = useState(false)

  async function search(q: string) {
    setSelected(null)
    setEvents([])
    const raw = q.trim()
    if (!raw) {
      setCandidates([])
      return
    }
    setLoading(true)
    const { data } = await supabase
      .from('tickets')
      .select('serial, make, model')
      .ilike('serial', `%${raw}%`)
      .is('deleted_at', null)
      .not('serial', 'is', null)
    setLoading(false)
    const seen = new Map<string, { serial: string; make: string | null; model: string | null }>()
    for (const t of data ?? []) {
      if (!t.serial) continue
      const key = normalize(t.serial)
      if (!seen.has(key)) seen.set(key, { serial: t.serial, make: t.make, model: t.model })
    }
    const list = [...seen.values()]
    setCandidates(list)
    if (list.length === 1) loadHistory(list[0].serial)
  }

  async function loadHistory(serial: string) {
    setSelected(serial)
    setLoading(true)
    const key = normalize(serial)

    const { data: allTickets } = await supabase
      .from('tickets')
      .select('*')
      .is('deleted_at', null)
      .not('serial', 'is', null)
    const tickets = (allTickets as Ticket[] | null)?.filter((t) => t.serial && normalize(t.serial) === key) ?? []
    tickets.sort((a, b) => a.opened_at.localeCompare(b.opened_at))

    const ticketIds = tickets.map((t) => t.id)
    const customerIds = [...new Set(tickets.map((t) => t.customer_id).filter((id): id is number => id != null))]

    const [customersRes, laborRes, partsRes, invoicesRes] = await Promise.all([
      customerIds.length
        ? supabase.from('customers').select('*').in('id', customerIds)
        : Promise.resolve({ data: [] as Customer[] }),
      ticketIds.length
        ? supabase.from('labor_lines').select('*').in('ticket_id', ticketIds)
        : Promise.resolve({ data: [] as LaborLine[] }),
      ticketIds.length
        ? supabase.from('part_lines').select('*').in('ticket_id', ticketIds)
        : Promise.resolve({ data: [] as PartLine[] }),
      ticketIds.length
        ? supabase.from('invoices').select('*').in('ticket_id', ticketIds)
        : Promise.resolve({ data: [] as Invoice[] }),
    ])

    const customers = (customersRes.data as Customer[] | null) ?? []
    const labor = (laborRes.data as LaborLine[] | null) ?? []
    const parts = (partsRes.data as PartLine[] | null) ?? []
    const invoices = (invoicesRes.data as Invoice[] | null) ?? []

    const custName = new Map(customers.map((c) => [c.id, c.name]))
    const invByTicket = new Map(invoices.filter((i) => !i.voided_at).map((i) => [i.ticket_id, i]))

    setEvents(
      tickets.map((t) => ({
        ticket: t,
        customerName: (t.customer_id && custName.get(t.customer_id)) || '—',
        labor: labor.filter((l) => l.ticket_id === t.id),
        parts: parts.filter((p) => p.ticket_id === t.id),
        invoice: invByTicket.get(t.id) ?? null,
      })),
    )
    setLoading(false)
  }

  useEffect(() => {
    const initial = searchParams.get('serial')
    if (initial) search(initial)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const drone = events[0]?.ticket
  const latestNickname = [...events].reverse().find((e) => e.ticket.nickname)?.ticket.nickname
  const totalBilled = events.reduce((s, e) => s + (e.invoice?.total ?? 0), 0)

  return (
    <div>
      <div className="no-print" style={{ maxWidth: 480 }}>
        <h2 style={{ margin: 0 }}>Drone service history</h2>
        <p className="muted" style={{ marginTop: 4 }}>
          Look up every ticket and invoice tied to a serial number — handy to print off when a drone changes hands.
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'flex-end' }}>
          <Field label="Serial number">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && search(query)}
              placeholder="e.g. SN12345"
            />
          </Field>
          <Button variant="primary" onClick={() => search(query)} disabled={loading}>
            Search
          </Button>
        </div>

        {candidates.length > 1 && (
          <div style={{ marginTop: 12 }}>
            <div className="kicker">Multiple serials match</div>
            {candidates.map((c) => (
              <div
                key={c.serial}
                style={{ padding: '6px 0', cursor: 'pointer', textDecoration: selected === c.serial ? 'underline' : undefined }}
                onClick={() => loadHistory(c.serial)}
              >
                {[c.make, c.model].filter(Boolean).join(' ') || '—'} — S/N {c.serial}
              </div>
            ))}
          </div>
        )}

        {candidates.length === 1 && events.length === 0 && !loading && (
          <p className="muted" style={{ marginTop: 12 }}>No service tickets found for that serial.</p>
        )}
      </div>

      {events.length > 0 && (
        <div className="card elev-md" style={{ maxWidth: 800, margin: '24px auto', padding: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <Logo height={56} />
              <p style={{ fontSize: 12 }}>
                Drone service &amp; repair
                <br />
                48303 115th Ave, Leigh NE 68643
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="kicker">Service history</div>
              <div style={{ fontSize: 22, fontWeight: 800 }}>
                {[drone?.make, drone?.model].filter(Boolean).join(' ') || '—'}
                {latestNickname ? ` "${latestNickname}"` : ''}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>S/N {drone?.serial}</div>
            </div>
          </div>

          <Button className="no-print" variant="secondary" style={{ marginTop: 16 }} onClick={() => window.print()}>
            Print
          </Button>

          <hr className="hr" />

          {events.map((e) => (
            <div key={e.ticket.id} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--color-divider)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <strong>{e.ticket.opened_at.slice(0, 10)}</strong>
                <span className="muted" style={{ fontSize: 12 }}>
                  Ticket {e.ticket.id} · {e.customerName} · {WARRANTY_LABEL[e.ticket.warranty]}
                </span>
              </div>
              {e.ticket.issue && <div style={{ marginTop: 4 }}>{e.ticket.issue}</div>}
              {e.labor.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <span className="kicker">Labor</span>
                  <div>{e.labor.map((l) => `${l.description} (${l.hours}h)`).join(', ')}</div>
                </div>
              )}
              {e.parts.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 13 }}>
                  <span className="kicker">Parts replaced</span>
                  <div>{e.parts.map((p) => `${p.qty} × ${p.name}`).join(', ')}</div>
                </div>
              )}
              <div style={{ marginTop: 6, fontSize: 13 }}>
                {e.invoice ? `Invoice ${e.invoice.id} — ${money(e.invoice.total)}` : 'Not invoiced'}
              </div>
            </div>
          ))}

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 800, marginTop: 8 }}>
            <span>{events.length} service {events.length === 1 ? 'event' : 'events'}</span>
            <span>Total billed {money(totalBilled)}</span>
          </div>
        </div>
      )}
    </div>
  )
}
