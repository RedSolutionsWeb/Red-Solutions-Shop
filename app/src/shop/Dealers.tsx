import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useReload } from './ReloadContext'
import type { Dealer, Order } from '../lib/types'
import { money } from '../lib/money'
import { Button } from '../ui/Button'
import { Field, Input } from '../ui/Field'
import { Dialog } from '../ui/Dialog'

export function Dealers() {
  const { bump } = useReload()
  const [dealers, setDealers] = useState<Dealer[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [editing, setEditing] = useState<Dealer | 'new' | null>(null)

  async function load() {
    const [d, o] = await Promise.all([
      supabase.from('dealers').select('*').order('name'),
      supabase.from('orders').select('*'),
    ])
    setDealers((d.data as Dealer[]) ?? [])
    setOrders((o.data as Order[]) ?? [])
  }

  useEffect(() => {
    load()
  }, [])

  const ordersByDealer = (id: number) => orders.filter((o) => o.dealer_id === id)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Dealers</h2>
        <Button variant="primary" onClick={() => setEditing('new')}>
          Add dealer account
        </Button>
      </div>

      <table className="table" style={{ marginTop: 16 }}>
        <thead>
          <tr>
            <th>Dealer</th>
            <th>Contact</th>
            <th>Email</th>
            <th>Off retail</th>
            <th>Terms</th>
            <th>Orders</th>
            <th>Billed</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {dealers.map((d) => {
            const dOrders = ordersByDealer(d.id)
            return (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td>{d.contact}</td>
                <td>{d.email}</td>
                <td>{d.discount_pct}%</td>
                <td>{d.terms}</td>
                <td>{dOrders.length}</td>
                <td>{money(d.balance)}</td>
                <td>
                  <button className="btn btn-ghost" onClick={() => setEditing(d)}>
                    Edit
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {dealers.length === 0 && (
        <div className="muted" style={{ padding: 16 }}>
          No dealer accounts yet. Add one and it becomes selectable in the dealer portal, priced at its discount.
        </div>
      )}

      {editing && (
        <DealerEditor
          dealer={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            load()
            bump()
          }}
        />
      )}
    </div>
  )
}

function DealerEditor({
  dealer,
  onClose,
  onSaved,
}: {
  dealer: Dealer | null
  onClose: () => void
  onSaved: () => void
}) {
  const [name, setName] = useState(dealer?.name ?? '')
  const [contact, setContact] = useState(dealer?.contact ?? '')
  const [phone, setPhone] = useState(dealer?.phone ?? '')
  const [email, setEmail] = useState(dealer?.email ?? '')
  const [discount, setDiscount] = useState(String(dealer?.discount_pct ?? 15))
  const [terms, setTerms] = useState(dealer?.terms ?? 'Net 30')
  const [balance, setBalance] = useState(String(dealer?.balance ?? 0))
  const [error, setError] = useState('')

  async function save() {
    if (!name.trim()) {
      setError('Enter a dealer name')
      return
    }
    const row = {
      name: name.trim(),
      contact,
      phone,
      email,
      discount_pct: Number(discount) || 0,
      terms,
      balance: Number(balance) || 0,
    }
    if (dealer) {
      await supabase.from('dealers').update(row).eq('id', dealer.id)
    } else {
      await supabase.from('dealers').insert(row)
    }
    onSaved()
  }

  async function del() {
    if (!dealer) return
    await supabase.from('dealers').delete().eq('id', dealer.id)
    onSaved()
  }

  return (
    <Dialog
      title="Dealer account"
      onClose={onClose}
      actions={
        <>
          {dealer && (
            <Button variant="ghost" onClick={del} style={{ marginRight: 'auto' }}>
              Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            Save dealer
          </Button>
        </>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Field label="Dealer / company name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Contact">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} />
          </Field>
          <Field label="Phone">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
        </div>
        <Field label="Email">
          <Input value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <Field label="Discount off retail (%)">
            <Input value={discount} onChange={(e) => setDiscount(e.target.value)} />
          </Field>
          <Field label="Terms">
            <Input value={terms} onChange={(e) => setTerms(e.target.value)} />
          </Field>
          <Field label="Balance owed">
            <Input value={balance} onChange={(e) => setBalance(e.target.value)} />
          </Field>
        </div>
        <p className="muted" style={{ fontSize: 12 }}>
          Every catalog price this dealer sees is retail less this percentage.
        </p>
        {error && <div style={{ color: 'var(--color-accent)', fontSize: 12 }}>{error}</div>}
      </div>
    </Dialog>
  )
}
