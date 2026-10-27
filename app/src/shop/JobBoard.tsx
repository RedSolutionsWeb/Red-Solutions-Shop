import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { useShopSettings } from '../lib/useShopSettings'
import { STAGES, type Customer, type Profile } from '../lib/types'
import { money } from '../lib/money'
import { Tag } from '../ui/Tag'

interface BoardTicket {
  ticket_id: string
  customer_id: number | null
  make: string | null
  model: string | null
  issue: string | null
  tech_id: string | null
  warranty: string
  status: string
  opened_at: string
  grand_total: number
  invoice_id: string | null
}

function daysOpen(openedAt: string) {
  const ms = Date.now() - new Date(openedAt).getTime()
  return Math.floor(ms / 86400000)
}

export function JobBoard() {
  const navigate = useNavigate()
  const { identity } = useAuth()
  const settings = useShopSettings()
  const [tickets, setTickets] = useState<BoardTicket[]>([])
  const [customers, setCustomers] = useState<Record<number, Customer>>({})
  const [techs, setTechs] = useState<Record<string, Profile>>({})
  const [lowStockCount, setLowStockCount] = useState(0)
  const [billedThisMonth, setBilledThisMonth] = useState(0)
  const [draftInvoices, setDraftInvoices] = useState(0)

  const isManager = identity?.kind === 'staff' && (identity.profile.role === 'owner' || identity.profile.role === 'sales')

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [ticketsRes, customersRes, profilesRes, partsRes, invoicesRes] = await Promise.all([
        supabase.from('ticket_totals').select('*'),
        supabase.from('customers').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('parts_view').select('qty_on_hand,category'),
        supabase.from('invoices').select('qbo_status,total,date').is('voided_at', null),
      ])
      if (cancelled) return
      setTickets((ticketsRes.data as BoardTicket[]) ?? [])
      setCustomers(Object.fromEntries(((customersRes.data as Customer[]) ?? []).map((c) => [c.id, c])))
      setTechs(Object.fromEntries(((profilesRes.data as Profile[]) ?? []).map((p) => [p.id, p])))

      const low = (partsRes.data ?? []).filter(
        (p: { qty_on_hand: number; category: string | null }) =>
          p.category !== 'Service' && p.qty_on_hand <= settings.low_stock_threshold
      ).length
      setLowStockCount(low)

      const invoices = (invoicesRes.data as { qbo_status: string; total: number; date: string }[]) ?? []
      setDraftInvoices(invoices.filter((i) => i.qbo_status === 'draft').length)
      const now = new Date()
      const thisMonth = invoices.filter((i) => {
        const d = new Date(i.date)
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
      setBilledThisMonth(thisMonth.reduce((s, i) => s + i.total, 0))
    }
    load()
    return () => {
      cancelled = true
    }
  }, [settings.low_stock_threshold])

  const openCount = tickets.filter((t) => t.status !== 'invoiced').length
  const readyToInvoice = tickets.filter((t) => t.status === 'in_repair').length

  const byStage = useMemo(() => {
    const map: Record<string, BoardTicket[]> = {}
    for (const s of STAGES) map[s.key] = []
    for (const t of tickets) map[t.status]?.push(t)
    return map
  }, [tickets])

  return (
    <div>
      <h2 style={{ margin: 0 }}>Job board</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        {openCount} open repairs · {draftInvoices} invoices waiting to send
      </p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          border: '1px solid var(--color-divider)',
          margin: '20px 0',
        }}
      >
        <Kpi label="Open repairs" value={openCount} note="across 4 stages" />
        <Kpi label="Ready to invoice" value={readyToInvoice} note="in repair now" />
        <Kpi
          label="Low stock parts"
          value={lowStockCount}
          note={`at or below ${settings.low_stock_threshold}`}
          accent={lowStockCount > 0}
        />
        {isManager ? (
          <Kpi label="Billed this month" value={money(billedThisMonth)} note={`${draftInvoices} drafts unsent`} />
        ) : (
          <Kpi label="Invoices to send" value={draftInvoices} note="drafts waiting" />
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {STAGES.map((stage) => (
          <div key={stage.key}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '2px solid var(--color-divider)',
                paddingBottom: 6,
                marginBottom: 10,
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              <span>{stage.label}</span>
              <span className="muted">{byStage[stage.key]?.length ?? 0}</span>
            </div>
            {(byStage[stage.key] ?? []).length === 0 && <div className="muted" style={{ fontSize: 12 }}>Nothing here.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(byStage[stage.key] ?? []).map((t) => {
                const cust = t.customer_id ? customers[t.customer_id] : null
                const tech = t.tech_id ? techs[t.tech_id] : null
                const age = daysOpen(t.opened_at)
                const issue = (t.issue ?? '').length > 78 ? (t.issue ?? '').slice(0, 78) + '…' : t.issue ?? ''
                return (
                  <div
                    key={t.ticket_id}
                    className="card elev-sm"
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/tickets/${t.ticket_id}`)}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div className="card-kicker">{t.ticket_id}</div>
                      <span style={{ fontSize: 11, color: age >= 7 ? 'var(--color-accent)' : undefined }}>
                        {age === 0 ? 'today' : `${age}d open`}
                      </span>
                    </div>
                    <div className="card-title">{cust?.name ?? 'Unknown customer'}</div>
                    <div style={{ fontSize: 13 }}>{[t.make, t.model].filter(Boolean).join(' ')}</div>
                    <div style={{ fontSize: 13, opacity: 0.6 }}>{issue}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{tech?.name ?? ''}</span>
                      <strong>{money(t.grand_total)}</strong>
                    </div>
                    {t.warranty !== 'none' && <Tag variant="outline">Warranty claim</Tag>}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({
  label,
  value,
  note,
  accent,
}: {
  label: string
  value: number | string
  note: string
  accent?: boolean
}) {
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
      <div className="muted" style={{ fontSize: 12 }}>
        {note}
      </div>
    </div>
  )
}
