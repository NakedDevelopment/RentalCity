import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatBedrooms, formatBathrooms, formatCurrency } from '../lib/propertyDraft'
import { VerificationStatusChecklist } from '../components/VerificationStatusChecklist'
import { useAuth } from '../lib/useAuth'
import { supabase } from '../lib/supabase'

type ApplicationDetail = {
  id: string
  propertyTitle: string
  propertyMeta: string
  neighborhood: string
  price: string
  acceptedDate: string
  status: string
  statusRaw: string
  features: string[]
  contactPhone: string
  contactLocation: string
  landlordName: string
  landlordId: string
  propertyId: string
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

function DetailCard({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      {title ? <h2 className="mb-4 text-[1.6rem] font-medium text-gray-900">{title}</h2> : null}
      {children}
    </section>
  )
}

const AMENITY_LABELS: Record<string, string> = {
  pet_friendly: 'Pet Friendly',
  parking: 'Parking',
  laundry: 'Laundry',
  gym: 'Gym',
  balcony: 'Balcony',
  yard: 'Yard',
}

function mapAmenities(amenities: string[] | null | undefined): string[] {
  if (!Array.isArray(amenities)) return []
  return amenities.map((a) => AMENITY_LABELS[a] ?? String(a)).filter(Boolean)
}

export function ApplicationDetailsPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { user } = useAuth()
  const [application, setApplication] = useState<ApplicationDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [withdrawing, setWithdrawing] = useState(false)
  const [reviewModalOpen, setReviewModalOpen] = useState(false)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewRating, setReviewRating] = useState(0)
  const [hasReview, setHasReview] = useState(false)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewError, setReviewError] = useState<string | null>(null)

  useEffect(() => {
    async function loadApplication() {
      if (!id || !user) {
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      const { data, error: err } = await supabase
        .from('applications')
        .select(`
          id,
          status,
          created_at,
          property:property_id(
            id,
            address_line1,
            title,
            city,
            state,
            bedrooms,
            bathrooms,
            sqft,
            monthly_rent_cents,
            amenities,
            landlord_id,
            landlord:landlord_id(id, display_name, phone)
          )
        `)
        .eq('id', id)
        .eq('tenant_id', user.id)
        .maybeSingle()

      setLoading(false)

      if (err) {
        setError(err.message)
        return
      }

      if (!data) {
        setError('Application not found')
        return
      }

      const row = data as {
        id: string
        status: string
        created_at: string
        property?: {
          id?: string
          address_line1?: string
          title?: string
          city?: string
          state?: string
          bedrooms?: number
          bathrooms?: number | string
          sqft?: number
          monthly_rent_cents?: number
          amenities?: string[]
          landlord_id?: string
          landlord?: { id?: string; display_name?: string; phone?: string } | null
        }
      }

      const p = row.property
      const title = p?.title || p?.address_line1 || 'Property'
      const beds = formatBedrooms(p?.bedrooms ?? 0)
      const baths = formatBathrooms(p?.bathrooms)
      const sqft = p?.sqft ? `${p.sqft} sq ft` : ''
      const meta = [beds, baths, sqft].filter(Boolean).join(' • ')
      const neighborhood = [p?.city, p?.state].filter(Boolean).join(', ') || '—'
      const price = p?.monthly_rent_cents != null ? `${formatCurrency(p.monthly_rent_cents)}/month` : '—'
      const features = mapAmenities(p?.amenities)
      if (features.length === 0) features.push('See property details')

      setApplication({
        id: row.id,
        propertyTitle: title,
        propertyMeta: meta,
        neighborhood,
        price,
        acceptedDate: formatAppliedDate(row.created_at),
        status: formatStatus(row.status),
        statusRaw: (row.status ?? 'pending').toLowerCase(),
        features,
        contactPhone: p?.landlord?.phone ?? '—',
        contactLocation: neighborhood,
        landlordName: p?.landlord?.display_name ?? 'Landlord',
        landlordId: p?.landlord?.id ?? p?.landlord_id ?? '',
        propertyId: p?.id ?? '',
      })

      const { data: reviewRow } = await supabase
        .from('landlord_reviews')
        .select('id, rating, comment')
        .eq('application_id', row.id)
        .eq('tenant_id', user.id)
        .maybeSingle()

      if (reviewRow) {
        setHasReview(true)
        setReviewRating((reviewRow as { rating?: number }).rating ?? 0)
        setReviewComment((reviewRow as { comment?: string | null }).comment ?? '')
      } else {
        setHasReview(false)
      }
    }

    loadApplication()
  }, [id, user])

  const handleWithdraw = async () => {
    if (!user || !application) return
    setWithdrawing(true)
    setError(null)
    const { error: err } = await supabase
      .from('applications')
      .update({ status: 'withdrawn' })
      .eq('id', application.id)
      .eq('tenant_id', user.id)
    setWithdrawing(false)
    if (err) {
      setError(err.message)
      return
    }
    navigate('/matches?tab=applied')
  }

  const handleSubmitReview = async () => {
    if (!user || !application || reviewRating < 1) return
    if (!application.landlordId) {
      setReviewError('Unable to submit review: landlord not found for this application.')
      return
    }
    setSubmittingReview(true)
    setReviewError(null)
    const { error: err } = await supabase.from('landlord_reviews').upsert(
      {
        application_id: application.id,
        tenant_id: user.id,
        landlord_id: application.landlordId,
        property_id: application.propertyId || null,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'application_id,tenant_id' },
    )
    setSubmittingReview(false)
    if (err) {
      setReviewError(err.message)
      return
    }
    setHasReview(true)
    setReviewModalOpen(false)
    navigate(`/account/application/${application.id}/review-submitted`)
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <p className="py-8 text-sm text-gray-500">Loading application...</p>
      </div>
    )
  }

  if (error || !application) {
    return (
      <div className="space-y-6">
        <p className="py-8 text-sm text-red-600">{error ?? 'Application not found'}</p>
      </div>
    )
  }

  return (
    <>
      <div className="space-y-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
          <div className="space-y-4">
            <DetailCard>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 19h16M5 7h14M7 19V7m10 12V7M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-[1.75rem] font-medium text-gray-900">{application.propertyTitle}</h1>
                  <p className="mt-1 text-sm text-gray-600">{application.propertyMeta}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {application.neighborhood}
                    </span>
                    <span>{application.price}</span>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="mb-3 text-[1.6rem] font-medium text-gray-900">Application Status</h2>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-lg bg-gray-50 px-4 py-3">
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-4 w-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {application.status === 'Accepted' ? 'Application Accepted' : `Application ${application.status}`}
                      </p>
                      <p className="text-sm text-gray-500">
                        {application.status === 'Accepted'
                          ? `Accepted on ${application.acceptedDate}`
                          : `${application.status} on ${application.acceptedDate}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                      {application.status}
                    </span>
                    {application.statusRaw === 'pending' && (
                      <button
                        type="button"
                        onClick={handleWithdraw}
                        disabled={withdrawing}
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {withdrawing ? 'Withdrawing…' : 'Withdraw application'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <h2 className="mb-4 text-[1.6rem] font-medium text-gray-900">Property Features</h2>
                <div className="grid gap-x-10 gap-y-4 sm:grid-cols-2 text-sm text-gray-700">
                  {application.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2.5">
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                      {feature}
                    </div>
                  ))}
                </div>
              </div>
            </DetailCard>

            <DetailCard>
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-700">
                  <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.761 0 5-2.686 5-6S14.761 0 12 0 7 2.686 7 6s2.239 6 5 6zm0 2c-4.418 0-8 2.686-8 6v2h16v-2c0-3.314-3.582-6-8-6z" />
                  </svg>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.75rem] font-medium text-gray-900">{application.landlordName}</h2>
                  <p className="mt-1 text-sm text-gray-600">Property Owner</p>
                </div>
              </div>

              {application.statusRaw === 'approved' ? (
                hasReview ? (
                  <div className="mt-6 rounded-lg bg-gray-50 px-4 py-4">
                    <div className="flex items-center gap-3">
                      <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <div className="flex-1">
                        <p className="text-[1.25rem] font-medium text-gray-900">Review Submitted</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Thanks for sharing your experience with {application.landlordName.split(' ')[0]}.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewModalOpen(true)}
                        className="inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Edit Review
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 rounded-lg bg-gray-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-[1.25rem] font-medium text-gray-900">Leave a Review</p>
                        <p className="mt-1 text-sm text-gray-500">
                          Share your experience as {application.landlordName.split(' ')[0]}&apos;s tenant
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setReviewModalOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white"
                      >
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927C9.349 2.005 10.651 2.005 10.951 2.927l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.922-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.176 0l-2.8 2.034c-.784.57-1.838-.196-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.719c-.783-.57-.38-1.81.588-1.81H7.03a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        Write Review
                      </button>
                    </div>
                  </div>
                )
              ) : null}
            </DetailCard>
          </div>

          <div className="space-y-4">
            <DetailCard title="Contact Information">
              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h2.28a2 2 0 011.897 1.368l1.156 3.47a2 2 0 01-.455 2.11l-1.274 1.274a16 16 0 006.364 6.364l1.274-1.274a2 2 0 012.11-.455l3.47 1.156A2 2 0 0121 18.72V21a2 2 0 01-2 2h-1C9.716 23 1 14.284 1 3V2a2 2 0 012-2z" />
                  </svg>
                  {application.contactPhone}
                </div>
                <div className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {application.contactLocation}
                </div>
              </div>
              <Link
                to="/messages"
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h8M8 14h5m-9 6h16a2 2 0 002-2V6a2 2 0 00-2-2H4a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Send Message
              </Link>
            </DetailCard>

            <DetailCard title="Verification Status">
              <VerificationStatusChecklist
                items={[
                  { label: 'Identity Verified', complete: true },
                  { label: 'Property Owner', complete: true },
                ]}
              />
            </DetailCard>
          </div>
        </div>

      </div>

      {reviewModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[310px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-[1.75rem] font-medium text-gray-900">Rate This Landlord</h2>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <label className="mb-2 block text-sm text-gray-700">Landlord Name</label>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm text-gray-600">
                  {application.landlordName}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-700">Property Address</label>
                <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2.5 text-center text-sm text-gray-600">
                  {application.propertyTitle}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-700">Rating</label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, index) => {
                      const filled = index < reviewRating

                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => setReviewRating(index + 1)}
                          className={`text-lg ${filled ? 'text-gray-900' : 'text-gray-300'}`}
                          aria-label={`Rate ${index + 1} stars`}
                        >
                          ★
                        </button>
                      )
                    })}
                  </div>
                  <span className="text-sm text-gray-600">{reviewRating} out of 5 stars</span>
                </div>
              </div>

              <div>
                <label htmlFor="review-comment" className="mb-2 block text-sm text-gray-700">
                  Comments (Optional)
                </label>
                <textarea
                  id="review-comment"
                  value={reviewComment}
                  onChange={(event) => setReviewComment(event.target.value)}
                  placeholder="Share your experience with this landlord..."
                  rows={4}
                  className="w-full rounded-md border border-gray-200 px-3 py-2.5 text-sm text-gray-700 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Your review will remain private and help improve our matching system.
                </p>
              </div>
            </div>

            {reviewError ? (
              <p className="px-5 pb-1 text-sm text-red-600">{reviewError}</p>
            ) : null}

            <div className="flex items-center gap-3 bg-gray-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                className="inline-flex min-w-[70px] items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitReview}
                disabled={reviewRating < 1 || submittingReview}
                className="inline-flex min-w-[106px] items-center justify-center rounded-lg btn-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
              >
                {submittingReview ? 'Submitting…' : hasReview ? 'Update Rating' : 'Submit Rating'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
