import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastContext = createContext<(msg: string) => void>(() => {})

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)

  const show = useCallback((m: string) => {
    setMsg(m)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setMsg(null), 3000)
  }, [])

  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div
          style={{
            position: 'fixed',
            bottom: 20,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--color-text)',
            color: 'var(--color-bg)',
            padding: '10px 18px',
            fontSize: 13,
            zIndex: 200,
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  )
}
