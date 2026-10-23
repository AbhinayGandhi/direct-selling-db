import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/auth'
import { Loading } from './ui'

// UI convenience only. Real protection is Row Level Security and server functions in the database.
export default function RequireAuth({ children }: { children: ReactNode }) {
  const { session, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <Loading />
  if (!session) return <Navigate to="/login" state={{ from: loc.pathname }} replace />
  return <>{children}</>
}
