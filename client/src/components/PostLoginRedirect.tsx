import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'

/** After login/signup, send admins to the admin portal; everyone else to the standard routes. */
export function PostLoginRedirect() {
  const { user } = useAuth()
  const { role, loading } = useProfileRole(user)

  if (!user) {
    return <Navigate to="/login" replace />
  }
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }
  if (role === 'admin') {
    return <Navigate to="/admin" replace />
  }
  return <Navigate to="/" replace />
}
