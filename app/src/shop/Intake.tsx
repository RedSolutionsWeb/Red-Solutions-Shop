import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useShopSettings } from '../lib/useShopSettings'
import { useReload } from './ReloadContext'
import { useToast } from '../ui/Toast'
import type { Customer, Profile, Warranty } from '../lib/types'
import { Field, Input, Select, Textarea } from '../ui/Field'
import { Button } from '../ui/Button'
import { money } from '../lib/money'

export function Intake() {
  const navigate = useNavigate()
  const settings = useShopSettings()
  const { bump } = useReload()
  const toast = useToast()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [techs, setTechs] = useState<Profile[]>([])
  const [customerId, setCustomerId] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [make, setMake] = useState('')
  const [model, setModel] = useState('')
  const [serial, setSerial] = useState('')
  const [techId, setTechId] = useState('')
  const [warranty, setWarranty] = useState<Warranty>('none')
  const [issue, setIssue] = useState('')
  const [addDiagnostic, setAddDiagnostic] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase
      .from('customers')
      .select('*')
      .order('name')
      .then(({ data }) => setCustomers((data as Customer[]) ?? []))
    supabase
      .from('profiles')
      .select('*')
      .order('name')
      .then(({ data }) => setTechs((data as Profile[]) ?? []))
  }, [])

  function pickCustomer(id: string) {
    setCustomerId(id)
    const c = customers.find((c) => String(c.id) === id)
    if (c) {
      setName(c.name)
      setContact(c.contact ?? '')
      setPhone(c.phone ?? '')
      setEmail(c.email ?? '')
    }
  }

  async function onSubmit() {
    setError('')
    if (!customerId && !name.trim()) {
      setError('Pick an existing customer or enter a name.')
      return
    }
    if (!issue.trim()) {
      setError('Describe the reported issue.')
      return
    }
    setBusy(true)
    try {
      let custId = customerId ? Number(customerId) : null
      if (!custId) {
        const { data, error } = await supabase
          .from('customers')
          .insert({ name: name.trim(), contact, phone, email })
          .select()
          .single()
        if (error) throw error
        custId = (data as Customer).id
      }

      const { data: ticket, error: tErr } = await supabase
        .from('tickets')
        .insert({
          customer_id: custId,
          make,
          model,
          serial,
          issue,
          tech_id: techId || null,
          warranty,
        })
        .select()
        .single()
      if (tErr) throw tErr

      if (addDiagnostic) {
        await supabase
          .from('labor_lines')
          .insert({ ticket_id: ticket.id, description: 'Diagnostic', hours: 1, rate: settings.labor_rate })
      }

      toast(`Ticket ${ticket.id} checked in`)
      bump()
      navigate(`/tickets/${ticket.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not check in the aircraft.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ margin: 0 }}>Check in an aircraft</h2>
      <p className="muted" style={{ marginTop: 4 }}>
        Creates a repair ticket and, optionally, an hour of diagnostic labor
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h5 style={{ margin: 0 }}>Customer</h5>
          <Field label="Existing customer">
            <Select value={customerId} onChange={(e) => pickCustomer(e.target.value)}>
              <option value="">New customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Company / customer name">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Contact">
              <Input value={contact} onChange={(e) => setContact(e.target.value)} />
            </Field>
            <Field label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
          </div>
          <Field label="Email (for the QuickBooks invoice)">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h5 style={{ margin: 0 }}>Aircraft</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Make">
              <Input value={make} onChange={(e) => setMake(e.target.value)} />
            </Field>
            <Field label="Model">
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </Field>
          </div>
          <Field label="Serial number">
            <Input value={serial} onChange={(e) => setSerial(e.target.value)} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Tech assigned">
              <Select value={techId} onChange={(e) => setTechId(e.target.value)}>
                <option value="">—</option>
                {techs.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Billing">
              <Select value={warranty} onChange={(e) => setWarranty(e.target.value as Warranty)}>
                <option value="none">Billable — customer pays</option>
                <option value="warranty">Warranty claim</option>
                <option value="insurance">Insurance claim</option>
              </Select>
            </Field>
          </div>
          <Field label="Reported issue">
            <Textarea value={issue} onChange={(e) => setIssue(e.target.value)} />
          </Field>
        </div>
      </div>

      <hr className="hr" />

      <label className="radio" style={{ marginBottom: 16 }}>
        <input type="checkbox" checked={addDiagnostic} onChange={(e) => setAddDiagnostic(e.target.checked)} />
        <span className="dot" />
        Add 1 hr diagnostic labor ({money(settings.labor_rate)}/hr)
      </label>

      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="secondary" onClick={() => navigate('/')}>
          Cancel
        </Button>
        <Button variant="primary" onClick={onSubmit} disabled={busy}>
          Check in &amp; open ticket
        </Button>
      </div>
      <div style={{ color: 'var(--color-accent)', fontSize: 12, marginTop: 8 }}>{error}</div>
    </div>
  )
}
