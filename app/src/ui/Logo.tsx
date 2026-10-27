import logo from '../assets/logo.png'

export function Logo({ height = 32 }: { height?: number }) {
  return <img src={logo} alt="Red Solutions" style={{ height, display: 'block' }} />
}
