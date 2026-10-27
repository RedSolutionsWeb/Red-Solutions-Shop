import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function RequireManager({ children }: { children: ReactNode }) {
  const { identity } = useAuth()
  const role = identity?.kind === 'staff' ? identity.profile.role : null
  if (role !== 'owner' && role !== 'sales') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
