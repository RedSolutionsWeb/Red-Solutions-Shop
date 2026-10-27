import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface NavCounts {
  openTickets: number
  parts: number
  bundles: number
  customers: number
  pendingOrders: number
  dealers: number
  invoices: number
}

const empty: NavCounts = {
  openTickets: 0,
  parts: 0,
  bundles: 0,
  customers: 0,
  pendingOrders: 0,
  dealers: 0,
  invoices: 0,
}

// Not live-subscribed — refetched by bumping `reloadKey` after a mutation
// that would change a count (checking in a ticket, invoicing, etc).
export function useNavCounts(reloadKey: number, isOwner: boolean) {
  const [counts, setCounts] = useState<NavCounts>(empty)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [tickets, parts, bundles, customers, invoices] = await Promise.all([
        supabase.from('tickets').select('id', { count: 'exact', head: true }).neq('status', 'invoiced').is('deleted_at', null),
        supabase.from('parts_view').select('sku', { count: 'exact', head: true }),
        supabase.from('bundles').select('id', { count: 'exact', head: true }),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).is('voided_at', null),
      ])
      let pendingOrders = 0
      let dealers = 0
      if (isOwner) {
        const [ordersRes, dealersRes] = await Promise.all([
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .in('status', ['submitted', 'quote_requested']),
          supabase.from('dealers').select('id', { count: 'exact', head: true }),
        ])
        pendingOrders = ordersRes.count ?? 0
        dealers = dealersRes.count ?? 0
      }
      if (!cancelled) {
        setCounts({
          openTickets: tickets.count ?? 0,
          parts: parts.count ?? 0,
          bundles: bundles.count ?? 0,
          customers: customers.count ?? 0,
          invoices: invoices.count ?? 0,
          pendingOrders,
          dealers,
        })
      }
    }
    load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey, isOwner])

  return counts
}
