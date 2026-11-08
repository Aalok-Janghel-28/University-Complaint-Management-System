import { Navigate } from 'react-router-dom'

import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from './LoadingSpinner'

const ProtectedRoute = ({ children, roles }) => {
  const { isAuthenticated, isLoading, user } = useAuth()

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <LoadingSpinner label="Loading account..." />
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (roles?.length && !roles.includes(user?.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return children
}

export default ProtectedRoute
