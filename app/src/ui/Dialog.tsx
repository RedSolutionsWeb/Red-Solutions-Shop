import type { ReactNode } from 'react'

export function Dialog({
  title,
  children,
  actions,
  onClose,
}: {
  title: string
  children: ReactNode
  actions: ReactNode
  onClose: () => void
}) {
  return (
    <div
      className="dialog-backdrop"
      style={{ zIndex: 90 }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="dialog" role="dialog" aria-modal="true">
        <div className="dialog-title">{title}</div>
        <div className="dialog-body">{children}</div>
        <div className="dialog-actions">{actions}</div>
      </div>
    </div>
  )
}
