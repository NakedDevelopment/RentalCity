import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { TenantAvatar } from '../components/TenantAvatar'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

type AcceptedTenant = {
  id: string
  profileId: string
  propertyId: string
  name: string
  avatarUrl: string | null
  property: string
  propertyAddress: string
  approvedDate: string
  status: string
  ratingStatus: 'Rated' | 'Not Rated'
  rating?: number
  comment?: string | null
}

type ApprovedApplicationRow = {
  id: string
  tenant_id: string
  property_id: string
  updated_at: string
  property: {
    title: string | null
    address_line1: string
    city: string
    state: string | null
  } | null
  tenant: {
    display_name: string | null
    avatar_url: string | null
  } | null
}

function formatDisplayDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function TenantsPage() {
  const { user } = useAuth()
  const location = useLocation()
  const tenantProfileNavState = useMemo(
    () => ({ from: `${location.pathname}${location.search}` }),
    [location.pathname, location.search],
  )
  const [searchParams, setSearchParams] = useSearchParams()
  const tenantIdFromUrl = searchParams.get('tenant')
  const [tenants, setTenants] = useState<AcceptedTenant[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('All Properties')
  const [ratingModalTenant, setRatingModalTenant] = useState<AcceptedTenant | null>(null)
  const [submittedTenant, setSubmittedTenant] = useState<AcceptedTenant | null>(null)
  const [selectedRating, setSelectedRating] = useState(4)
  const [feedback, setFeedback] = useState('')
  const [submittingRating, setSubmittingRating] = useState(false)
  const [ratingError, setRatingError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)

  const propertyOptions = useMemo(
    () => ['All Properties', ...Array.from(new Set(tenants.map((tenant) => tenant.property)))],
    [tenants],
  )

  const filteredTenants = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return tenants.filter((tenant) => {
      const matchesQuery = normalizedQuery
        ? tenant.name.toLowerCase().includes(normalizedQuery)
        : true
      const matchesProperty =
        propertyFilter === 'All Properties' ? true : tenant.property === propertyFilter

      return matchesQuery && matchesProperty
    })
  }, [propertyFilter, searchQuery, tenants])

  function openRatingModal(tenant: AcceptedTenant, initialRating?: number, initialComment?: string) {
    setRatingModalTenant(tenant)
    setSelectedRating(initialRating ?? tenant.rating ?? 4)
    setFeedback(initialComment ?? tenant.comment ?? '')
    setRatingError(null)
  }

  useEffect(() => {
    async function loadTenants() {
      if (!user) {
        setLoading(false)
        return
      }

      setLoading(true)
      setPageError(null)

      const [{ data: applicationsData, error: applicationsError }, { data: ratingsData, error: ratingsError }] =
        await Promise.all([
          supabase
            .from('applications')
            .select(
              'id, tenant_id, property_id, updated_at, property:property_id(title, address_line1, city, state), tenant:tenant_id(display_name, avatar_url)',
            )
            .eq('status', 'approved'),
          supabase
            .from('tenant_ratings')
            .select('tenant_external_id, rating, comment')
            .eq('landlord_id', user.id),
        ])

      setLoading(false)

      if (applicationsError) {
        setPageError(applicationsError.message)
        return
      }

      if (ratingsError) {
        setPageError(ratingsError.message)
        return
      }

      const ratingsByTenant = new Map(
        (ratingsData ?? []).map((r: { tenant_external_id: string; rating?: number; comment?: string | null }) => [
          r.tenant_external_id,
          { rating: r.rating ?? 0, comment: r.comment ?? null },
        ])
      )
      const mapped = ((applicationsData ?? []) as unknown as ApprovedApplicationRow[]).map((application) => {
        const propertyTitle = application.property?.title || application.property?.address_line1 || 'Property'
        const propertyAddress = [
          application.property?.address_line1,
          application.property?.city,
          application.property?.state,
        ]
          .filter(Boolean)
          .join(', ')
        const ratingInfo = ratingsByTenant.get(application.tenant_id)
        const isRated = ratingInfo != null

        return {
          id: application.id,
          profileId: application.tenant_id,
          propertyId: application.property_id,
          name: application.tenant?.display_name || 'Tenant',
          avatarUrl: application.tenant?.avatar_url ?? null,
          property: propertyTitle,
          propertyAddress,
          approvedDate: formatDisplayDate(application.updated_at),
          status: 'Accepted',
          ratingStatus: isRated ? 'Rated' : 'Not Rated',
          rating: ratingInfo?.rating,
          comment: ratingInfo?.comment,
        } satisfies AcceptedTenant
      })

      setTenants(mapped)
    }

    loadTenants()
  }, [user])

  useEffect(() => {
    if (!tenantIdFromUrl || loading || pageError || tenants.length === 0) return
    const found = tenants.find((t) => t.profileId === tenantIdFromUrl)
    setSearchParams({}, { replace: true })
    if (!found) return
    setRatingModalTenant(found)
    setSelectedRating(found.rating ?? 4)
    setFeedback(found.comment ?? '')
    setRatingError(null)
  }, [tenantIdFromUrl, loading, pageError, tenants, setSearchParams])

  async function submitRating() {
    if (!ratingModalTenant || !user) return

    setSubmittingRating(true)
    setRatingError(null)

    const tenantId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        ratingModalTenant.profileId,
      )
        ? ratingModalTenant.profileId
        : null

    const { error } = await supabase
      .from('tenant_ratings')
      .upsert(
        {
          landlord_id: user.id,
          tenant_id: tenantId,
          tenant_external_id: ratingModalTenant.profileId,
          tenant_name: ratingModalTenant.name,
          property_name: ratingModalTenant.property,
          property_address: ratingModalTenant.propertyAddress,
          rating: selectedRating,
          comment: feedback.trim() || null,
        },
        { onConflict: 'landlord_id,tenant_external_id' },
      )

    setSubmittingRating(false)

    if (error) {
      setRatingError(error.message)
      return
    }

    const wasEdit = ratingModalTenant.ratingStatus === 'Rated'
    setTenants((current) =>
      current.map((tenant) =>
        tenant.id === ratingModalTenant.id
          ? { ...tenant, ratingStatus: 'Rated', rating: selectedRating, comment: feedback.trim() || null }
          : tenant,
      ),
    )
    setRatingModalTenant(null)
    if (!wasEdit) setSubmittedTenant(ratingModalTenant)
  }

  return (
    <>
      <div className="space-y-6">
        <div className="mb-5">
          <Link to="/account" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900">
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
          <h1 className="mt-3 text-[2rem] font-medium text-gray-900">Tenants</h1>
        </div>

        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_180px]">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search tenants by name..."
                className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
              />
            </div>

            <div className="relative">
              <select
                value={propertyFilter}
                onChange={(event) => setPropertyFilter(event.target.value)}
                className="h-full w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-3 pr-10 text-sm text-gray-700 outline-none focus:border-gray-300"
              >
                {propertyOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>
              <svg className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </section>

        {pageError ? <p className="mt-4 text-sm text-red-600">{pageError}</p> : null}
        {loading ? <p className="mt-4 text-sm text-gray-500">Loading tenants...</p> : null}

        {!loading && !pageError && filteredTenants.length === 0 ? (
          <section className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-8 py-14 text-center">
            <h2 className="text-[1.45rem] font-medium text-gray-900">No accepted tenants yet</h2>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              Approved applications will appear here once you start accepting tenants.
            </p>
          </section>
        ) : null}

        <div className="mt-4 space-y-4">
          {filteredTenants.map((tenant) => (
            <section key={tenant.id} className="rounded-xl border border-gray-200 bg-white px-4 py-4">
              <div className="flex items-start justify-between gap-4">
                <Link
                  to={`/matches/tenant/${encodeURIComponent(tenant.profileId)}?${new URLSearchParams({
                    property: tenant.propertyId,
                    application: tenant.id,
                    mode: 'full',
                    status: 'accepted',
                  }).toString()}`}
                  state={tenantProfileNavState}
                  className="group flex min-w-0 flex-1 items-start gap-4 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                >
                  <TenantAvatar name={tenant.name} avatarUrl={tenant.avatarUrl} />
                  <div className="min-w-0">
                    <h2 className="text-[1.45rem] font-medium text-gray-900 decoration-gray-400 underline-offset-2 group-hover:underline">
                      {tenant.name}
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">{tenant.property}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-500">
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                        </svg>
                        Approved: {tenant.approvedDate}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        {tenant.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <span>Rating Status:</span>
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          tenant.ratingStatus === 'Rated'
                            ? 'bg-gray-900 text-white'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {tenant.ratingStatus}
                      </span>
                    </div>
                  </div>
                </Link>

                {tenant.ratingStatus === 'Rated' ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openRatingModal(tenant)}
                      className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit Rating
                    </button>
                    <Link
                      to={`/matches/tenant/${encodeURIComponent(tenant.profileId)}?${new URLSearchParams({
                        property: tenant.propertyId,
                        application: tenant.id,
                        mode: 'full',
                        status: 'accepted',
                      }).toString()}`}
                      state={tenantProfileNavState}
                      className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white"
                    >
                      View Profile
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openRatingModal(tenant)}
                    className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white"
                  >
                    Rate Tenant
                  </button>
                )}
              </div>
            </section>
          ))}
        </div>

        <section className="mt-4 rounded-xl border border-gray-200 bg-white px-5 py-4">
          <div className="flex items-start gap-2.5">
            <svg className="mt-0.5 h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-gray-800">About Tenant Ratings</p>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                You can rate tenants after they&apos;ve been accepted. Reviews are visible to other landlords on the
                tenant&apos;s profile; each landlord can edit only their own review.
              </p>
            </div>
          </div>
        </section>

      </div>

      {ratingModalTenant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[318px] rounded-xl bg-white shadow-xl">
            <div className="border-b border-gray-100 px-4 py-4">
              <h2 className="text-[1.6rem] font-medium text-gray-900">
                {ratingModalTenant.ratingStatus === 'Rated' ? 'Edit Rating' : 'Rate Your Tenant'}
              </h2>
            </div>

            <div className="px-4 py-4">
              <div>
                <p className="mb-2 text-sm text-gray-500">Tenant Name</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800">
                  {ratingModalTenant.name}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm text-gray-500">Property Address</p>
                <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-sm text-gray-800">
                  {ratingModalTenant.propertyAddress}
                </div>
              </div>

              <div className="mt-4">
                <p className="mb-2 text-sm text-gray-500">Rating</p>
                <div className="flex items-center gap-1">
                  {Array.from({ length: 5 }, (_, index) => {
                    const starValue = index + 1
                    const filled = starValue <= selectedRating

                    return (
                      <button
                        key={starValue}
                        type="button"
                        onClick={() => setSelectedRating(starValue)}
                        className={filled ? 'text-gray-900' : 'text-gray-300'}
                        aria-label={`Rate ${starValue} stars`}
                      >
                        <svg className="h-7 w-7" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.074 3.308a1 1 0 00.95.69h3.478c.969 0 1.371 1.24.588 1.81l-2.814 2.044a1 1 0 00-.364 1.118l1.075 3.307c.299.922-.755 1.688-1.539 1.118l-2.814-2.044a1 1 0 00-1.176 0l-2.814 2.044c-.783.57-1.838-.196-1.539-1.118l1.075-3.307a1 1 0 00-.364-1.118L2.98 8.735c-.783-.57-.38-1.81.588-1.81h3.478a1 1 0 00.95-.69l1.074-3.308z" />
                        </svg>
                      </button>
                    )
                  })}
                </div>
                <p className="mt-1 text-sm text-gray-500">{selectedRating} out of 5 stars</p>
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm text-gray-500">Optional Feedback</label>
                <textarea
                  value={feedback}
                  onChange={(event) => setFeedback(event.target.value)}
                  placeholder="Share details about the tenant experience..."
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 px-3 py-3 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-300 focus:outline-none"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRatingModalTenant(null)}
                  disabled={submittingRating}
                  className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={submitRating}
                  disabled={submittingRating}
                  className="inline-flex items-center justify-center rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  {submittingRating ? 'Saving...' : ratingModalTenant.ratingStatus === 'Rated' ? 'Save Changes' : 'Submit Review'}
                </button>
              </div>

              {ratingError ? <p className="mt-3 text-sm text-red-600">{ratingError}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {submittedTenant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[336px] rounded-xl bg-white px-6 py-8 text-center shadow-xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-700">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mt-5 text-[2rem] font-medium text-gray-900">Thank You</h2>
            <p className="mt-4 text-sm leading-7 text-gray-600">
              Your review has been saved. Other landlords can see it on this tenant&apos;s profile; you can update it
              anytime from the tenant profile or reviews page.
            </p>
            <button
              type="button"
              onClick={() => setSubmittedTenant(null)}
              className="mt-6 inline-flex min-w-[120px] items-center justify-center rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white"
            >
              Got It!
            </button>
          </div>
        </div>
      ) : null}
    </>
  )
}
