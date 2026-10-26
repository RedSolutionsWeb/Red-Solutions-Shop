import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Field, Input } from '../ui/Field'
import { Button } from '../ui/Button'

export function ChangePinForm({ onDone }: { onDone: () => void }) {
  const { refreshIdentity } = useAuth()
  const [pin, setPin] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (pin.trim().length < 4) {
      setError('PIN must be at least 4 characters.')
      return
    }
    if (pin.trim() !== confirm.trim()) {
      setError('PINs do not match.')
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: pin.trim() })
    if (updateError) {
      setBusy(false)
      setError(updateError.message)
      return
    }
    await supabase.rpc('clear_must_change_password')
    await refreshIdentity()
    setBusy(false)
    onDone()
  }

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Field label="New PIN">
        <Input
          type="password"
          autoComplete="new-password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          required
        />
      </Field>
      <Field label="Confirm PIN">
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" variant="primary" block disabled={busy}>
        {busy ? 'Saving…' : 'Save PIN'}
      </Button>
      <div style={{ minHeight: 18, color: 'var(--color-accent)', fontSize: 12 }}>{error}</div>
    </form>
  )
}
