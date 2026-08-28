import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LandlordRatingsGivenPublicCard } from '../components/LandlordRatingsGivenPublicCard'
import { computeLandlordResponseRate, type LandlordResponseRateResult } from '../lib/landlordResponseRate'
import { fetchTenantLandlordProfile } from '../lib/landlordProfileApi'
import { safeInternalPath } from '../lib/safeInternalPath'
import { supabase } from '../lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function TenantLandlordProfilePage() {
  const { id = '' } = useParams()
  const [searchParams] = useSearchParams()
  const returnTo = safeInternalPath(searchParams.get('returnTo')) ?? '/matches'
  const propertyId = searchParams.get('property')

  const [profile, setProfile] = useState<{
    display_name: string | null
    avatar_url: string | null
    phone: string | null
    bio: string | null
    city: string | null
    created_at: string | null
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [responseMetrics, setResponseMetrics] = useState<LandlordResponseRateResult | null>(null)
  const [responseMetricsLoading, setResponseMetricsLoading] = useState(false)

  const landlordId = useMemo(() => {
    if (id && UUID_RE.test(id)) return id
    return null
  }, [id])

  function Card({ title, children }: { title?: string; children: React.ReactNode }) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        {title ? <h2 className="mb-4 text-base font-semibold tracking-tight text-gray-900">{title}</h2> : null}
        {children}
      </section>
    )
  }

  function AvatarPlaceholder({ initials }: { initials: string }) {
    return (
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-600">
        <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
        <span className="sr-only">{initials}</span>
      </div>
    )
  }

  useEffect(() => {
    const canUsePropertyLookup = propertyId && UUID_RE.test(propertyId)
    if (!id || !UUID_RE.test(id)) {
      setNotFound(true)
      setLoading(false)
      return
    }

    let cancelled = false
    ;(async () => {
      const { data: sessionData } = await supabase.auth.getSession()
      const accessToken = sessionData.session?.access_token ?? null

      if (accessToken) {
        try {
          const server = await fetchTenantLandlordProfile(accessToken, {
            propertyId: canUsePropertyLookup ? propertyId : null,
            landlordId: id,
          })
          const serverProfile = server?.profile ?? null
          if (!cancelled && serverProfile) {
            setProfile(serverProfile)
            setNotFound(false)
            setLoading(false)
            return
          }
        } catch {
          // fall through to client-side queries
        }
      }

      // Prefer looking up the landlord via the listing we came from. This aligns with tenant RLS rules
      // (tenants can always read active listings, and landlords with active listings are readable).
      const { data, error } = canUsePropertyLookup
        ? await supabase
            .from('properties')
            .select('landlord_id, landlord:landlord_id(display_name, avatar_url, phone, bio, city, created_at)')
            .eq('id', propertyId!)
            .maybeSingle()
        : await supabase
            .from('profiles')
            .select('display_name, avatar_url, phone, bio, city, created_at')
            .eq('id', id)
            .maybeSingle()

      if (cancelled) return

      const resolvedProfile = canUsePropertyLookup
        ? ((data as any)?.landlord && Array.isArray((data as any).landlord) ? (data as any).landlord[0] : (data as any)?.landlord) ?? null
        : data

      if (error || !resolvedProfile) {
        setNotFound(true)
        setProfile(null)
      } else {
        setProfile(resolvedProfile)
        setNotFound(false)
      }
      setLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [id, propertyId])

  useEffect(() => {
    if (!landlordId) {
      setResponseMetrics(null)
      setResponseMetricsLoading(false)
      return
    }
    let cancelled = false
    setResponseMetricsLoading(true)
    computeLandlordResponseRate(supabase, landlordId)
      .then((r) => {
        if (!cancelled) setResponseMetrics(r)
      })
      .catch(() => {
        if (!cancelled) setResponseMetrics(null)
      })
      .finally(() => {
        if (!cancelled) setResponseMetricsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [landlordId])

  if (loading) {
    return (
      <div className="flex min-h-[240px] items-center justify-center px-4">
        <span className="text-sm text-gray-500">Loading…</span>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="mx-auto max-w-lg space-y-4 px-4 py-10">
        <Link
          to={returnTo}
          className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <p className="text-sm text-gray-600">This profile isn’t available or couldn’t be loaded.</p>
      </div>
    )
  }

  const name = profile.display_name?.trim() || 'Landlord'
  const initials =
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('') || 'L'

  return (
    <div className="space-y-6">
      <Link
        to={returnTo}
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to matches
      </Link>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <Card>
            <div className="flex items-start gap-4">
              {profile?.avatar_url?.trim() ? (
                <div className="h-14 w-14 overflow-hidden rounded-full bg-gray-100 text-gray-400 ring-1 ring-black/5">
                  <img src={profile.avatar_url.trim()} alt={name} className="h-full w-full object-cover" />
                </div>
              ) : (
                <AvatarPlaceholder initials={initials} />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.9rem] font-medium text-gray-900">{name}</h2>
                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                  {profile?.city?.trim() ? (
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {profile.city}
                    </span>
                  ) : null}
                  {profile?.created_at ? (
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                      </svg>
                      Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </Card>

          <Card title="About Me">
            <p className="max-w-3xl text-sm leading-8 text-gray-700">
              {profile?.bio?.trim()
                ? profile.bio
                : `I'm a professional property manager with over 6 years of experience in the San Francisco rental market. I believe in creating positive, long-term relationships with my tenants and maintaining high-quality living spaces. I'm responsive to maintenance requests and always available for any questions or concerns.`}
            </p>
          </Card>

          <Card title="Business Information">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Business Name</p>
                <p className="mt-1 text-sm text-gray-900">Johnson Property Management LLC</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Business Type</p>
                <p className="mt-1 text-sm text-gray-900">Limited Liability Company</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-500">Business Address</p>
                <p className="mt-1 text-sm text-gray-900">1234 Market Street, Suite 500, San Francisco, CA 94102</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Business Phone</p>
                <p className="mt-1 text-sm text-gray-900">(415) 555-0123</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Business Email</p>
                <p className="mt-1 text-sm text-gray-900">info@johnsonproperties.com</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-sm text-gray-500">Website</p>
                <p className="mt-1 text-sm text-gray-900">www.johnsonproperties.com</p>
              </div>
            </div>
          </Card>

          <Card title="Contact Information">
            <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Personal Phone</p>
                <p className="mt-1 text-sm text-gray-900">{profile?.phone?.trim() || '(415) 555-0198'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Personal Email</p>
                <p className="mt-1 text-sm text-gray-900">sarah.johnson@email.com</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Preferred Contact Method</p>
                <p className="mt-1 text-sm text-gray-900">Email</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Emergency Contact</p>
                <p className="mt-1 text-sm text-gray-900">Michael Johnson - (415) 555-0199</p>
              </div>
            </div>
          </Card>

          {landlordId ? <LandlordRatingsGivenPublicCard landlordId={landlordId} /> : null}
        </div>

        <div className="space-y-5">
          <Card title="Responsiveness">
            {responseMetricsLoading ? (
              <p className="text-sm text-gray-500">Calculating…</p>
            ) : responseMetrics?.overallPercent != null ? (
              <>
                <p className="text-[2rem] font-medium leading-none text-gray-900">{responseMetrics.overallPercent}%</p>
                <p className="mt-2 text-xs leading-5 text-gray-500">
                  Weighted blend of message replies (48h), application decisions after unlock (7d), and tenant ratings
                  after acceptance (14d).
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500">Responsiveness score isn’t available for this profile.</p>
            )}
          </Card>
        </div>
      </div>

    </div>
  )
}
