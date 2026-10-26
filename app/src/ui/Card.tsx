import type { ReactNode } from 'react'

export function Card({ className = '', children }: { className?: string; children: ReactNode }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function CardKicker({ children }: { children: ReactNode }) {
  return <div className="card-kicker">{children}</div>
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <div className="card-title">{children}</div>
}

export function CardBody({ children }: { children: ReactNode }) {
  return <p className="card-body">{children}</p>
}

export function CardMeta({ children }: { children: ReactNode }) {
  return <div className="card-meta">{children}</div>
}
