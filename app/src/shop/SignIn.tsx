import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import { Field, Input } from '../ui/Field'
import { Button } from '../ui/Button'
import { Logo } from '../ui/Logo'

export function SignIn() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await signIn(email, pin)
    setBusy(false)
    if (error) setError(error)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        background: 'var(--color-bg)',
      }}
    >
      <div style={{ width: 400, border: '2px solid var(--color-divider)', padding: 24 }}>
        <Logo />
        <div className="kicker" style={{ marginTop: 8 }}>Repair &amp; inventory</div>
        <hr className="hr" />
        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Email">
            <Input
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="PIN">
            <Input
              type="password"
              autoComplete="current-password"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              required
            />
          </Field>
          <Button type="submit" variant="primary" block disabled={busy}>
            Sign in
          </Button>
          <div style={{ minHeight: 18, color: 'var(--color-accent)', fontSize: 12 }}>{error}</div>
        </form>
        <div style={{ fontSize: 11, opacity: 0.6, marginTop: 8 }}>
          Demo accounts
          <br />
          jackson@redstarne.com · 1234
          <br />
          redsolutionsservice@gmail.com · 5678
        </div>
      </div>
    </div>
  )
}
