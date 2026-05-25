import { Navigate } from 'react-router-dom'

export function PrivateRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  return children
}

export function AdminRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/dashboard" replace />
  return children
}

export function UserRoute({ user, children }) {
  if (!user) return <Navigate to="/login" replace />
  if (user.role === 'admin' && !user.is_impersonating) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
