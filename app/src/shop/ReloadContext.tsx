import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

const ReloadContext = createContext<{ key: number; bump: () => void }>({ key: 0, bump: () => {} })

export function useReload() {
  return useContext(ReloadContext)
}

export function ReloadProvider({ children }: { children: ReactNode }) {
  const [key, setKey] = useState(0)
  const bump = useCallback(() => setKey((k) => k + 1), [])
  return <ReloadContext.Provider value={{ key, bump }}>{children}</ReloadContext.Provider>
}
