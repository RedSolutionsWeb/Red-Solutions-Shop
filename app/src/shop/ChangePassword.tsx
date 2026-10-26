import { useState, type FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Field, Input } from '../ui/Field'
import { Button } from '../ui/Button'

export function ChangePasswordForm({ onDone }: { onDone: () => void }) {
  const { refreshIdentity } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (password.trim().length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password.trim() !== confirm.trim()) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: password.trim() })
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
      <Field label="New password">
        <Input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </Field>
      <Field label="Confirm password">
        <Input
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </Field>
      <Button type="submit" variant="primary" block disabled={busy}>
        {busy ? 'Saving…' : 'Save password'}
      </Button>
      <div style={{ minHeight: 18, color: 'var(--color-accent)', fontSize: 12 }}>{error}</div>
    </form>
  )
}
