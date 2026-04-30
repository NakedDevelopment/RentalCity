import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'

type Filter = 'all' | 'unread' | 'matches' | 'applications' | 'reviews'
type ProfileRole = 'tenant' | 'landlord'
type NotificationType =
  | 'property_match'
  | 'application_update'
  | 'message'
  | 'application_approved'
  | 'review'
  | 'listing_update'
  | 'approval'
  | 'flagged'

interface Notification {
  id: string
  type: NotificationType
  title: string
  body: string
  time: string
  read: boolean
  link?: string | null
  propertyId?: string | null
}

function getPrimaryCta(
  type: NotificationType,
  link: string | null | undefined,
  propertyId: string | null | undefined
): { label: string; to: string; primary: boolean } {
  const resolvedLink =
    link ??
    ((type === 'property_match' || type === 'listing_update') && propertyId ? `/property/${propertyId}` : null)
  if (resolvedLink) {
    const label =
      type === 'property_match' || type === 'listing_update'
        ? 'View Property'
        : type === 'application_update' || type === 'application_approved' || type === 'approval'
          ? 'View Application'
          : type === 'message'
            ? 'Reply'
            : 'View Details'
    return {
      label,
      to: resolvedLink.startsWith('/') ? resolvedLink : `/${resolvedLink}`,
      primary: type === 'property_match' || type === 'listing_update',
    }
  }
  switch (type) {
    case 'property_match':
    case 'listing_update':
      return { label: 'View Property', to: propertyId ? `/property/${propertyId}` : '/matches', primary: true }
    case 'application_update':
    case 'application_approved':
    case 'approval':
      return { label: 'View Application', to: '/matches?tab=applied', primary: false }
    case 'message':
      return { label: 'Reply', to: '/messages', primary: false }
    case 'review':
      return { label: 'View Details', to: '/matches', primary: false }
    case 'flagged':
      return { label: 'View', to: '/matches?tab=applied', primary: false }
    default:
      return { label: 'View Details', to: '/matches', primary: false }
  }
}

function formatRelativeTime(value: string) {
  const date = new Date(value)
  const diffMs = Date.now() - date.getTime()
  const diffMinutes = Math.max(1, Math.floor(diffMs / 60000))

  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return date.toLocaleDateString()
}

function normalizeNotificationType(value: string | null): NotificationType {
  switch (value) {
    case 'property_match':
    case 'application_update':
    case 'message':
    case 'application_approved':
    case 'review':
    case 'listing_update':
    case 'approval':
    case 'flagged':
      return value
    default:
      return 'message'
  }
}

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'property_match':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    case 'application_update':
    case 'application_approved':
    case 'listing_update':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    case 'message':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )
    case 'review':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.036 3.19a1 1 0 00.95.69h3.354c.969 0 1.371 1.24.588 1.81l-2.714 1.972a1 1 0 00-.364 1.118l1.036 3.19c.3.921-.755 1.688-1.539 1.118l-2.714-1.972a1 1 0 00-1.176 0l-2.714 1.972c-.783.57-1.838-.197-1.539-1.118l1.036-3.19a1 1 0 00-.364-1.118L2.17 8.617c-.783-.57-.38-1.81.588-1.81h3.354a1 1 0 00.95-.69l1.036-3.19z" />
        </svg>
      )
    case 'approval':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5-2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    case 'flagged':
      return (
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
        </svg>
      )
    default:
      return null
  }
}

export function NotificationsPage() {
  const { user } = useAuth()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [filter, setFilter] = useState<Filter>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadNotifications() {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data: notificationData, error: notificationError } = await supabase
        .from('notifications')
        .select('id, title, body, type, link, property_id, read_at, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setLoading(false)

      if (notificationError) {
        setError(notificationError.message)
        return
      }

      setNotifications(
        (notificationData ?? []).map((notification) => ({
          id: notification.id,
          type: normalizeNotificationType(notification.type),
          title: notification.title,
          body: notification.body ?? '',
          time: formatRelativeTime(notification.created_at),
          read: Boolean(notification.read_at),
          link: notification.link,
          propertyId: notification.property_id ?? null,
        })),
      )
    }

    loadNotifications()
  }, [user])

  const filters = useMemo(() => {
    if (profileRole === 'landlord') {
      return [
        { value: 'all', label: 'All' },
        { value: 'unread', label: 'Unread' },
        { value: 'matches', label: 'Matches' },
        { value: 'reviews', label: 'Reviews' },
      ] satisfies { value: Filter; label: string }[]
    }

    return [
      { value: 'all', label: 'All' },
      { value: 'unread', label: 'Unread' },
      { value: 'matches', label: 'Matches' },
      { value: 'applications', label: 'Applications' },
    ] satisfies { value: Filter; label: string }[]
  }, [profileRole])

  const filtered = notifications.filter((notification) => {
    if (filter === 'unread') return !notification.read
    if (filter === 'matches') return notification.type === 'property_match'
    if (filter === 'reviews') return notification.type === 'review'
    if (filter === 'applications') {
      return notification.type === 'application_update' || notification.type === 'application_approved'
    }
    return true
  })

  async function markAllRead() {
    if (!user) return

    const unreadIds = notifications.filter((notification) => !notification.read).map((notification) => notification.id)
    if (unreadIds.length === 0) return

    const timestamp = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: timestamp })
      .in('id', unreadIds)

    if (error) {
      setError(error.message)
      return
    }

    setNotifications((prev) => prev.map((notification) => ({ ...notification, read: true })))
  }

  async function markOneRead(id: string) {
    const target = notifications.find((n) => n.id === id)
    if (!target || target.read) return
    const ts = new Date().toISOString()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: ts })
      .eq('id', id)
      .eq('user_id', user!.id)
    if (error) {
      setError(error.message)
      return
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
    )
  }

  async function dismissNotification(id: string) {
    const target = notifications.find((n) => n.id === id)
    const wasUnread = target && !target.read

    setNotifications((prev) => prev.filter((n) => n.id !== id))

    if (wasUnread && user) {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id)

      if (error) setError(error.message)
    }
  }

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-medium text-gray-900">Notifications</h1>
          <p className="mt-2 text-sm text-gray-600">
            {profileRole === 'landlord'
              ? 'Stay updated on your property matches and applications'
              : 'Stay updated on your property matches and applications'}
          </p>
        </div>

        <button
          type="button"
          onClick={markAllRead}
          className="pt-3 text-sm text-gray-600 hover:text-gray-900"
        >
          Mark all as read
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            className={`rounded-lg px-4 py-2 text-sm transition-colors ${
              filter === item.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading notifications...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-gray-500">No notifications in this category.</div>
        ) : (
          filtered.map((notification, index) => {
            const cta = getPrimaryCta(notification.type, notification.link, notification.propertyId)
            return (
              <div
                key={notification.id}
                className={`flex items-start gap-4 px-4 py-5 sm:px-5 ${
                  index !== filtered.length - 1 ? 'border-b border-gray-200' : ''
                }`}
              >
                <div className="flex flex-shrink-0 items-start gap-3 pt-0.5">
                  {!notification.read ? (
                    <span className="mt-2.5 h-2 w-2 flex-shrink-0 rounded-full bg-gray-900" aria-hidden />
                  ) : (
                    <span className="w-2 flex-shrink-0" />
                  )}
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-white">
                    {typeIcon(notification.type)}
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900">{notification.title}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-600">{notification.body}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <Link
                      to={cta.to}
                      onClick={() => markOneRead(notification.id)}
                      className={
                        cta.primary
                          ? 'inline-flex items-center gap-1.5 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800'
                          : 'inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50'
                      }
                    >
                      {cta.label}
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        dismissNotification(notification.id)
                      }}
                      className="text-sm font-medium text-gray-600 hover:text-gray-900"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>

                <div className="flex flex-shrink-0 items-center gap-3 pl-2 text-xs text-gray-400">
                  <span>{notification.time}</span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}

    </div>
  )
}
