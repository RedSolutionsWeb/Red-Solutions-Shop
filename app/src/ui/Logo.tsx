import logoIcon from '../assets/logo-icon.png'
import logoRed from '../assets/logo-red.png'

export function Logo({ variant = 'dark', height = 32 }: { variant?: 'dark' | 'light'; height?: number }) {
  const fg = variant === 'light' ? '#fff' : 'var(--color-text)'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: height * 0.25, height }}>
      <img src={logoIcon} alt="" style={{ height, width: height, flex: 'none', objectFit: 'contain' }} />
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: height * 0.12,
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: height * 0.5,
          letterSpacing: '-0.02em',
          color: fg,
          lineHeight: 1,
        }}
      >
        <img src={logoRed} alt="RED" style={{ height: height * 0.55, display: 'block' }} />
        SOLUTIONS
      </span>
    </div>
  )
}
