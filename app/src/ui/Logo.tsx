// Placeholder wordmark — the original logo-full.png / logo-full-white.png /
// logo-gear.png assets lived only in the container that was reclaimed and
// couldn't be reconstructed from conversation text (unlike the SQL/TSX
// source, which could). Swap this for an <img> once the real files are
// back; it's styled to sit in the same header slot at the same height.
export function Logo({ variant = 'dark', height = 32 }: { variant?: 'dark' | 'light'; height?: number }) {
  const fg = variant === 'light' ? '#fff' : 'var(--color-text)'
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, height }}>
      <span
        style={{
          width: height * 0.7,
          height: height * 0.7,
          background: 'var(--color-accent)',
          flex: 'none',
        }}
      />
      <span
        style={{
          fontFamily: 'var(--font-heading)',
          fontWeight: 800,
          fontSize: height * 0.5,
          letterSpacing: '-0.02em',
          color: fg,
          lineHeight: 1,
        }}
      >
        RED <span style={{ color: 'var(--color-accent)' }}>SOLUTIONS</span>
      </span>
    </div>
  )
}
