import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../context/AuthContext'
import { Spinner } from './ui'

export default function ProtectedRoute({
  children,
  requireApprover = false,
  requireAdmin = false,
}: {
  children: ReactNode
  requireApprover?: boolean
  requireAdmin?: boolean
}) {
  const { session, profile, loading } = useAuth()

  if (loading) return <Spinner />
  if (!session) return <Navigate to="/login" replace />

  // Admins are a superset of approvers — the RLS policies grant them the same
  // rights via is_approver(), so the UI must not lock them out of the inbox.
  if (requireApprover && !(profile?.role === 'approver' || profile?.role === 'admin'))
    return <Navigate to="/controls" replace />
  if (requireAdmin && profile?.role !== 'admin')
    return <Navigate to="/controls" replace />

  return <>{children}</>
}
