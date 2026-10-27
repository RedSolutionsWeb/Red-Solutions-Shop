export type Role = 'owner' | 'tech' | 'sales'
export type Warranty = 'none' | 'warranty' | 'insurance'
export type TicketStatus = 'intake' | 'diagnosis' | 'in_repair' | 'invoiced'
export type OrderStatus = 'quote_requested' | 'submitted' | 'approved' | 'rejected' | 'invoiced'
export type QboStatus = 'draft' | 'exported' | 'sent'

export const STAGES: { key: TicketStatus; label: string }[] = [
  { key: 'intake', label: 'Intake' },
  { key: 'diagnosis', label: 'Diagnosis / Quote' },
  { key: 'in_repair', label: 'In Repair' },
  { key: 'invoiced', label: 'Invoiced' },
]

export interface Profile {
  id: string
  name: string
  email: string
  role: Role
  must_change_password: boolean
}

export interface DealerUser {
  id: string
  dealer_id: number
  name: string
  email: string
}

export interface ShopSettings {
  id: true
  shop_name: string
  address: string
  labor_rate: number
  tax_rate: number
  low_stock_threshold: number
  notify_emails: string[]
}

export interface Customer {
  id: number
  name: string
  contact: string | null
  phone: string | null
  email: string | null
}

export interface Part {
  sku: string
  name: string
  category: string | null
  fits: string[]
  qty_on_hand: number
  cost: number | null // owner-only, via parts_view
  price: number
}

export interface PartView extends Part {
  margin: number | null
}

export interface Bundle {
  id: number
  sku: string
  name: string
}

export interface BundleLine {
  bundle_id: number
  sku: string
  qty: number
}

export interface BundleComponent {
  sku: string
  name: string
  qty: number
  price: number
}

export interface BundlePricing {
  bundle_id: number
  sku: string
  name: string
  retail_total: number
  buildable: number
  components: BundleComponent[]
}

export interface Ticket {
  id: string
  customer_id: number | null
  make: string | null
  model: string | null
  serial: string | null
  issue: string | null
  tech_id: string | null
  warranty: Warranty
  claim: string | null
  status: TicketStatus
  opened_at: string
  notes: string | null
}

export interface TimeEntry {
  id: number
  ticket_id: string
  tech_id: string
  description: string
  started_at: string
  stopped_at: string | null
  cancelled: boolean
}

export interface LaborLine {
  id: number
  ticket_id: string
  description: string
  hours: number
  rate: number
}

export interface PartLine {
  id: number
  ticket_id: string
  sku: string | null
  name: string
  qty: number
  price: number
  bundle_id: number | null
  kit: BundleComponent[] | null
}

export interface Dealer {
  id: number
  name: string
  contact: string | null
  phone: string | null
  email: string | null
  discount_pct: number
  terms: string
  balance: number
}

export interface Order {
  id: number
  dealer_id: number
  po: string | null
  ship_address: string | null
  ship_method: string | null
  is_quote: boolean
  status: OrderStatus
  created_at: string
}

export interface OrderLine {
  id: number
  order_id: number
  sku: string | null
  bundle_id: number | null
  name: string
  qty: number
  price: number
  retail: number
  kit: BundleComponent[] | null
}

export interface Invoice {
  id: string
  ticket_id: string | null
  order_id: number | null
  date: string
  due_date: string | null
  qbo_status: QboStatus
  terms: string
  rep: string | null
  tax_exempt: boolean
  tax_rate: number
  subtotal: number
  tax_amount: number
  total: number
  qbo_invoice_id: string | null
  qbo_link: string | null
  voided_at: string | null
}

export interface InvoiceLine {
  id: number
  invoice_id: string
  kind: 'labor' | 'part' | 'bundle'
  description: string
  qty: number
  unit_price: number
  amount: number
  kit: BundleComponent[] | null
}
