import logo from '../assets/logo.png'

// Intrinsic size of logo.png (849x900) — set explicitly so a flex container
// with the default align-items: stretch can't distort the aspect ratio.
const ASPECT = 849 / 900

export function Logo({ height = 32 }: { height?: number }) {
  return (
    <img
      src={logo}
      alt="Red Solutions"
      style={{ height, width: height * ASPECT, display: 'block', flex: 'none' }}
    />
  )
}
