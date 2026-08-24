import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

export default function ProtectedRoute({
  children,
  requireApprover = false,
}: {
  children: ReactNode
  requireApprover?: boolean
}) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />
  if (requireApprover && profile?.role !== 'approver')
    return <Navigate to="/controls" replace />

  return <>{children}</>
}
