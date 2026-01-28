import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedRoles?: string[]
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { isAuthenticated, user } = useAuthStore()
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    const defaultPaths: Record<string, string> = {
      admin: '/admin',
      company: '/company',
      employee: '/employee',
      guard: '/guard',
    }
    return <Navigate to={defaultPaths[user.role] || '/'} replace />
  }

  return <>{children}</>
}
