import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'
import { CreditConsentCard } from '../components/CreditConsentCard'

type ProfileRecord = {
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  bio: string | null
  city: string | null
  created_at: string
} | null

type AppliedProperty = {
  id: string
  name: string
  landlord: string
  appliedDate: string
  status: string
}

function formatStatus(dbStatus: string): string {
  const map: Record<string, string> = {
    approved: 'Accepted',
    rejected: 'Declined',
    pending: 'Pending',
    withdrawn: 'Withdrawn',
  }
  return map[dbStatus?.toLowerCase()] ?? dbStatus ?? 'Pending'
}

function formatAppliedDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function SectionCard({
  title,
  complete,
  children,
}: {
  title: string
  complete?: boolean
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        {complete && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200">
            <svg className="h-3.5 w-3.5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}
      </div>
      {children}
    </section>
  )
}

export function RentalApplicationPage() {
  const { user } = useAuth()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [profile, setProfile] = useState<ProfileRecord>(null)
  const [, setAppliedProperties] = useState<AppliedProperty[]>([])
  const [universalApplication, setUniversalApplication] = useState<{
    id: string
    status: string
    valid_until: string
    created_at: string
  } | null>(null)
  const [, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      if (!user || profileRole === null || profileRole !== 'tenant') {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const [{ data: profileData }, { data: appsData }, { data: universalData }] = await Promise.all([
        supabase
          .from('profiles')
          .select('display_name, avatar_url, phone, bio, city, created_at')
          .eq('id', user.id)
          .maybeSingle(),
        supabase
          .from('applications')
          .select(`
            id,
            status,
            created_at,
            property:property_id(title, address_line1, landlord:profiles(display_name))
          `)
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('universal_applications')
          .select('id, status, valid_until, created_at')
          .eq('tenant_id', user.id)
          .order('created_at', { ascending: false })
          .limit(1),
      ])

      setProfile(profileData ?? null)

      const rows = (appsData ?? []) as Array<{
        id: string
        status: string
        created_at: string
        property?: {
          title?: string
          address_line1?: string
          landlord?: { display_name?: string } | null
        }
      }>

      setAppliedProperties(
        rows.map((row) => ({
          id: row.id,
          name: row.property?.title || row.property?.address_line1 || 'Property',
          landlord: row.property?.landlord?.display_name ?? 'Landlord',
          appliedDate: formatAppliedDate(row.created_at),
          status: formatStatus(row.status),
        })),
      )

      const latestUniversal =
        (universalData?.length ?? 0) > 0
          ? (universalData as Array<{ id: string; status: string; valid_until: string; created_at: string }>)[0]
          : null
      setUniversalApplication(latestUniversal)

      setLoading(false)
    }

    load()
  }, [user, profileRole])

  if (!user || roleLoading) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  if (profileRole !== 'tenant') {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-sm text-gray-500">Rental application is only available for tenants.</span>
      </div>
    )
  }

  const now = new Date()

  const createdDate = universalApplication ? new Date(universalApplication.created_at) : null
  const validUntil = universalApplication ? new Date(universalApplication.valid_until) : null

  let validUntilDisplay = 'Not started'
  let remainingDisplay = '—'
  let remainingPercent = 0

  if (createdDate && validUntil) {
    validUntilDisplay = validUntil.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })

    const totalMs = validUntil.getTime() - createdDate.getTime()
    const elapsedMs = now.getTime() - createdDate.getTime()
    const remainingMs = validUntil.getTime() - now.getTime()

    if (remainingMs <= 0 || totalMs <= 0) {
      remainingDisplay = 'Expired'
      remainingPercent = 100
    } else {
      const remainingDays = Math.round(remainingMs / (1000 * 60 * 60 * 24))
      const remainingMonths = Math.floor(remainingDays / 30)
      const remainingDaysRemainder = remainingDays % 30
      remainingDisplay = `${remainingMonths} months, ${remainingDaysRemainder} days`

      remainingPercent = Math.min(100, Math.max(0, (elapsedMs / totalMs) * 100))
    }
  }

  const isApplicationActive =
    Boolean(universalApplication) &&
    universalApplication?.status === 'active' &&
    validUntil != null &&
    validUntil.getTime() > now.getTime()


  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          to="/matches?tab=applied"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          aria-label="Back to applied matches"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-[1.75rem] font-semibold text-gray-900">Your Rental Application</h1>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {isApplicationActive && (
            <span className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm font-medium text-gray-700">
              Active
            </span>
          )}
          <Link
            to="/applications/apply"
            className="inline-flex items-center rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white"
          >
            {isApplicationActive ? 'Renew Application' : 'Start Application'}
          </Link>
        </div>
        {isApplicationActive && (
          <p className="text-sm text-gray-500">Update active application for 50% off</p>
        )}
      </div>

      {error ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm text-red-600">{error}</p>
        </section>
      ) : null}

      {/* Profile completion prompt — shown when payment is active but profile is empty */}
      {isApplicationActive && profile && !profile.display_name && !profile.phone ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <svg className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-800">Complete your profile</p>
              <p className="mt-0.5 text-sm text-amber-700">
                Your application is active but your profile is empty. Add your name and contact info so landlords can review your application.
              </p>
              <Link
                to="/account/edit"
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-900 underline hover:text-amber-700"
              >
                Complete profile
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          <SectionCard
            title="Personal Information"
            complete={Boolean(profile?.display_name || profile?.phone || user?.email)}
          >
            <div className="grid gap-x-10 gap-y-6 sm:grid-cols-2">
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Basic Details</p>
                <div>
                  <p className="text-sm text-gray-500">Full Name</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{profile?.display_name?.trim() || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{user?.email || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{profile?.phone || '—'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date of Birth</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">—</p>
                </div>
              </div>
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Current Address</p>
                <div>
                  <p className="text-sm text-gray-500">Address</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">—</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">City, State</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{profile?.city || '—'}</p>
                </div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Emergency Contact</p>
                <div>
                  <p className="text-sm text-gray-500">Name & Relation</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">—</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">—</p>
                </div>
              </div>
            </div>
            <Link
              to="/account/edit"
              className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
            >
              Update in profile
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </SectionCard>

        </div>

        <div className="space-y-5">
          <CreditConsentCard isApplicationActive={isApplicationActive} />

          <SectionCard title="Expiration Information">
          <div className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Valid Until</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{validUntilDisplay}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Time Remaining</p>
              <div className="mt-2 h-2 rounded-full bg-gray-200">
                <div
                  className="h-2 rounded-full bg-gray-600"
                  style={{ width: `${Math.max(0, Math.min(100, createdDate ? 100 - remainingPercent : 0))}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-600">{remainingDisplay}</p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              <div className="mb-1 flex items-center gap-2 text-xs font-medium text-gray-600">
                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-gray-300 text-[0.6rem] text-white">
                  i
                </span>
                <span>Expiration details</span>
              </div>
              <p>Your application is valid for 6 months from creation date.</p>
            </div>
          </div>
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

