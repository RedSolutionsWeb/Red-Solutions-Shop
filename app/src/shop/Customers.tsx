import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money } from '../lib/money'

interface Row {
  id: number
  name: string
  contact: string | null
  phone: string | null
  openJobs: number
  allJobs: number
  billed: number
  firstTicketId: string | null
}

export function Customers() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    async function load() {
      const [customersRes, ticketsRes, invoicesRes] = await Promise.all([
        supabase.from('customers').select('*').order('name'),
        supabase.from('tickets').select('id,customer_id,status').is('deleted_at', null).order('opened_at'),
        supabase.from('invoices').select('ticket_id,total').is('voided_at', null),
      ])
      const tickets = ticketsRes.data ?? []
      const invoices = invoicesRes.data ?? []
      const ticketToTotal = new Map<string, number>()
      for (const inv of invoices) if (inv.ticket_id) ticketToTotal.set(inv.ticket_id, inv.total)

      const list = (customersRes.data ?? []).map((c: { id: number; name: string; contact: string | null; phone: string | null }) => {
        const custTickets = tickets.filter((t) => t.customer_id === c.id)
        const openJobs = custTickets.filter((t) => t.status !== 'invoiced').length
        const billed = custTickets.reduce((s, t) => s + (ticketToTotal.get(t.id) ?? 0), 0)
        return {
          id: c.id,
          name: c.name,
          contact: c.contact,
          phone: c.phone,
          openJobs,
          allJobs: custTickets.length,
          billed,
          firstTicketId: custTickets[0]?.id ?? null,
        }
      })
      setRows(list)
    }
    load()
  }, [])

  return (
    <div>
      <h2 style={{ margin: 0 }}>Customers</h2>
      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Contact</th>
            <th>Phone</th>
            <th>Open jobs</th>
            <th>All jobs</th>
            <th>Lifetime billed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              style={{ cursor: r.firstTicketId ? 'pointer' : undefined }}
              onClick={() => r.firstTicketId && navigate(`/tickets/${r.firstTicketId}`)}
            >
              <td>{r.name}</td>
              <td>{r.contact}</td>
              <td>{r.phone}</td>
              <td>{r.openJobs}</td>
              <td>{r.allJobs}</td>
              <td>{money(r.billed)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
