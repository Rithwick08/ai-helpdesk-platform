import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RoleProtectedRoute({ allowedRoles }) {
  const { isAuthenticated, role } = useAuth()

  // 1. If not authenticated at all, go to login
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  // 2. If authenticated but role isn't in allowedRoles (and user isn't admin)
  // Admins bypass role restrictions for these portals if needed, but let's strictly check allowedRoles
  // We can include 'admin' in allowedRoles per route if we want admin to have access.
  if (!allowedRoles.includes(role) && role !== 'admin') {
    // Redirect to default home page based on role
    switch (role) {
      case 'employee': return <Navigate to="/assistant" replace />
      case 'it':       return <Navigate to="/it-support" replace />
      case 'soc':      return <Navigate to="/soc" replace />
      case 'admin':    return <Navigate to="/dashboard" replace />
      default:         return <Navigate to="/login" replace />
    }
  }

  return <Outlet />
}
