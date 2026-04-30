import { Link } from 'react-router-dom'
import { useAuth } from '../../lib/useAuth'
import { useProfileRole } from '../../lib/useProfileRole'
import { AdminPageHeader, AdminLoadingBlock, admin } from './adminUi'

export function AdminProfilePage() {
  const { user } = useAuth()
  const { displayName, loading } = useProfileRole(user)

  if (loading) {
    return (
      <div>
        <AdminPageHeader title="Your account" description="Signed-in admin profile and security." />
        <AdminLoadingBlock className={admin.contentTop} />
      </div>
    )
  }

  return (
    <div>
      <AdminPageHeader title="Your account" description="Signed-in admin profile and security." />

      <div className={`${admin.contentTop} max-w-lg space-y-4 ${admin.panelPaddedLg}`}>
        <div>
          <p className={admin.fieldLabel}>Email</p>
          <p className="mt-1 text-sm text-gray-900">{user?.email ?? '—'}</p>
        </div>
        <div>
          <p className={admin.fieldLabel}>Display name</p>
          <p className="mt-1 text-sm text-gray-800">{displayName ?? '—'}</p>
        </div>
        <div className="pt-2">
          <Link to="/admin/change-password" className={admin.btnPrimary}>
            Change password
          </Link>
        </div>
      </div>
    </div>
  )
}
