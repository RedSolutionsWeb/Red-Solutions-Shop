import type { ReactNode } from 'react'

type Variant = 'accent' | 'neutral' | 'outline'

export function Tag({ variant = 'neutral', children }: { variant?: Variant; children: ReactNode }) {
  return <span className={`tag tag-${variant}`}>{children}</span>
}
