import { Logo } from '../ui/Logo'
import { ChangePinForm } from './ChangePin'

export function SetPin() {
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
        <div className="kicker" style={{ marginTop: 8 }}>Choose your own PIN</div>
        <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
          For security, pick a PIN only you know before you continue.
        </p>
        <hr className="hr" />
        <ChangePinForm onDone={() => {}} />
      </div>
    </div>
  )
}
