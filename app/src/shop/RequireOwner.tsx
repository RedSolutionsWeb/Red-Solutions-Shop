import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export function RequireOwner({ children }: { children: ReactNode }) {
  const { identity } = useAuth()
  if (identity?.kind !== 'staff' || identity.profile.role !== 'owner') {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}
