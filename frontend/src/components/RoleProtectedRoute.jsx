import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function RoleProtectedRoute({ allowedRoles }) {
  return <Outlet />
}
