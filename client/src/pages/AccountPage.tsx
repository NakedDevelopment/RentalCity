import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { LandlordInviteTenantsCard } from '../components/LandlordInviteTenantsCard'
import { LandlordRatingsGivenCard } from '../components/LandlordRatingsGivenCard'
import {
  TENANT_LANDLORD_REVIEWS_PREVIEW_COUNT,
  TENANT_REVIEWS_CARD_TITLE,
  TENANT_REVIEWS_DESCRIPTION_AS_TENANT,
  TenantReviewListRowContent,
} from '../components/TenantReviewDisplay'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { computeLandlordResponseRate, type LandlordResponseRateResult } from '../lib/landlordResponseRate'
import { supabase } from '../lib/supabase'
import {
  UNIVERSAL_APPLICATION_STATUS_ACTION_CLASS,
  UniversalApplicationStatusFields,
} from '../components/UniversalApplicationStatusFields'
import { VerificationStatusCard } from '../components/VerificationStatusChecklist'
import {
  hasTenantLeasePreferencesData,
  TenantLeasePreferencesDisplay,
} from '../components/TenantLeasePreferencesDisplay'
import {
  computeUniversalApplicationDisplay,
  type UniversalApplicationRecord,
} from '../lib/universalApplicationDisplay'
import {
  normalizeLandlordReviewRows,
  type LandlordReviewAboutTenantRow,
} from '../lib/landlordReviewsAboutTenant'
import { getTenantQuestionnaireChoiceLabel } from '../lib/tenantQuestionnaire'

type TenantPreferencesRecord = {
  lease_length_months: number | null
  move_in_date: string | null
  min_budget_cents: number | null
  max_budget_cents: number | null
  has_pets: boolean | null
  living_situation: string | null
} | null

type ProfileRecord = {
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  bio: string | null
  city: string | null
  business_name?: string | null
  landlord_property_count_range?: string | null
  landlord_experience_level?: string | null
  created_at: string
} | null


function Card({
  title,
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      {title ? <h2 className="mb-4 text-base font-semibold tracking-tight text-gray-900">{title}</h2> : null}
      {children}
    </section>
  )
}

function SectionEditButton({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link
      to={to}
      className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
    >
      {children}
      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}

function AvatarPlaceholder({ initials }: { initials: string }) {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-600">
      <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
      <span className="sr-only">{initials}</span>
    </div>
  )
}

export function AccountPage() {
  const { user } = useAuth()
  const { role: profileRole, loading: roleLoading } = useProfileRole(user)
  const [profile, setProfile] = useState<ProfileRecord>(null)
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false)
  const [tenantPrefs, setTenantPrefs] = useState<TenantPreferencesRecord>(null)
  const [questionnaireAnswers, setQuestionnaireAnswers] = useState<Record<string, unknown> | null>(null)
  const [landlordReviewsAboutMe, setLandlordReviewsAboutMe] = useState<LandlordReviewAboutTenantRow[]>([])
  const [universalApplication, setUniversalApplication] = useState<UniversalApplicationRecord | null>(null)
  const [responseMetrics, setResponseMetrics] = useState<LandlordResponseRateResult | null>(null)
  const [responseMetricsLoading, setResponseMetricsLoading] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      if (!user || profileRole === null) return

      // * avoids 400 when landlord business columns aren’t migrated yet on the linked Supabase project.
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()

      setProfile(profileData)

      if (profileRole === 'tenant') {
        const [{ data: prefsData }, { data: questionnaireData }, { data: universalData }, { data: ratingsRaw }] =
          await Promise.all([
            supabase
              .from('tenant_preferences')
              .select('lease_length_months, move_in_date, min_budget_cents, max_budget_cents, has_pets, living_situation')
              .eq('user_id', user.id)
              .maybeSingle(),
            supabase.from('tenant_questionnaire').select('answers').eq('user_id', user.id).maybeSingle(),
            supabase
              .from('universal_applications')
              .select('status, valid_until, created_at')
              .eq('tenant_id', user.id)
              .order('created_at', { ascending: false })
              .limit(1),
            supabase
              .from('tenant_ratings')
              .select(
                'id, rating, comment, property_name, property_address, created_at, landlord:landlord_id(display_name)',
              )
              .eq('tenant_external_id', user.id)
              .order('created_at', { ascending: false }),
          ])
        setTenantPrefs(prefsData ?? null)
        setQuestionnaireAnswers((questionnaireData as { answers?: Record<string, unknown> } | null)?.answers ?? null)
        setUniversalApplication((universalData?.[0] as UniversalApplicationRecord | undefined) ?? null)
        setLandlordReviewsAboutMe(
          normalizeLandlordReviewRows((ratingsRaw ?? []) as LandlordReviewAboutTenantRow[]),
        )
      } else {
        setLandlordReviewsAboutMe([])
      }
    }

    loadProfile()
  }, [user, profileRole])

  useEffect(() => {
    if (!user?.id || profileRole !== 'landlord') {
      setResponseMetrics(null)
      setResponseMetricsLoading(false)
      return
    }
    let cancelled = false
    setResponseMetricsLoading(true)
    computeLandlordResponseRate(supabase, user.id)
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
  }, [user?.id, profileRole])

  const landlordReviewsPreview = useMemo(
    () => landlordReviewsAboutMe.slice(0, TENANT_LANDLORD_REVIEWS_PREVIEW_COUNT),
    [landlordReviewsAboutMe],
  )

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex flex-1 items-center justify-center py-12">
        <span className="text-gray-500">Loading...</span>
      </div>
    )
  }

  const fullName = profile?.display_name?.trim() || user?.email?.split('@')[0] || 'Add your name'
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'SJ'

  const now = new Date()
  const {
    statusLabel: universalStatusLabel,
    validUntilText,
    remainingText,
    remainingBarWidthPct,
    isUniversalActive,
  } = computeUniversalApplicationDisplay(universalApplication, now)

  if (profileRole === 'landlord') {
    const missingBusinessInfo =
      !profile?.business_name?.trim() ||
      !profile?.landlord_property_count_range ||
      !profile?.landlord_experience_level

    return (
      <div className="space-y-6">
        <h1 className="mb-6 text-[2rem] font-medium text-gray-900">My Profile</h1>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_220px]">
          <div className="space-y-5">
            <Card>
              <div className="flex items-start gap-4">
                {profile?.avatar_url ? (
                  <button
                    type="button"
                    onClick={() => setPhotoPreviewOpen(true)}
                    className="h-14 w-14 overflow-hidden rounded-full bg-gray-100 text-gray-400 hover:ring-2 hover:ring-gray-300"
                    aria-label="View profile photo"
                  >
                    <img
                      src={profile.avatar_url}
                      alt={fullName}
                      className="h-full w-full object-cover"
                    />
                  </button>
                ) : (
                  <AvatarPlaceholder initials={initials} />
                )}
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.9rem] font-medium text-gray-900">{fullName}</h2>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                    {profile?.city && (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {profile.city}
                      </span>
                    )}
                    {profile?.created_at && (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                        </svg>
                        Joined {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <SectionEditButton to="/account/edit">Edit photo & name</SectionEditButton>
            </Card>

            <Card title="About Me">
              <p className="max-w-3xl text-sm leading-8 text-gray-700">
                {profile?.bio?.trim()
                  ? profile.bio
                  : `I'm a professional property manager with over 6 years of experience in the San Francisco rental market. I believe in creating positive, long-term relationships with my tenants and maintaining high-quality living spaces. I'm responsive to maintenance requests and always available for any questions or concerns.`}
              </p>
              <SectionEditButton to="/account/edit">Edit about me</SectionEditButton>
            </Card>

            <Card title="Business Information">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Business Name</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile?.business_name?.trim() || '—'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Properties managed</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile?.landlord_property_count_range || '—'}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-sm text-gray-500">Landlord experience</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {profile?.landlord_experience_level || '—'}
                  </p>
                </div>
              </div>
              {missingBusinessInfo ? (
                <div className="mt-5 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 p-4">
                  <p className="text-sm text-gray-700">
                    Finish your business details to build trust with tenants and improve match quality.
                  </p>
                  <Link
                    to="/account/edit"
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                  >
                    Complete business info
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              ) : (
                <SectionEditButton to="/account/edit">Edit business information</SectionEditButton>
              )}
            </Card>

            <Card title="Contact Information">
              <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
                <div>
                  <p className="text-sm text-gray-500">Personal Phone</p>
                  <p className="mt-1 text-sm text-gray-900">(415) 555-0198</p>
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
              <SectionEditButton to="/account/edit">Edit contact information</SectionEditButton>
            </Card>

            <LandlordRatingsGivenCard />

            <Card title="Match Preferences">
              <p className="text-sm text-gray-600">
                Update the survey answers we use to match your listings with tenants.
              </p>
              <Link
                to="/onboarding/survey?mode=edit"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
              >
                Edit survey
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </Card>

            <LandlordInviteTenantsCard />
          </div>

          <div className="space-y-5">
            <Card title="Responsiveness">
              {responseMetricsLoading ? (
                <p className="text-sm text-gray-500">Calculating your score…</p>
              ) : responseMetrics?.overallPercent != null ? (
                <>
                  <p className="text-[2rem] font-medium leading-none text-gray-900">
                    {responseMetrics.overallPercent}%
                  </p>
                  <p className="mt-2 text-xs leading-5 text-gray-500">
                    Weighted blend of message replies (48h), application decisions after unlock (7d), and
                    tenant ratings after acceptance (14d). Parts with no data yet are omitted from the blend.
                  </p>
                  <dl className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-xs text-gray-600">
                    {responseMetrics.messagePercent != null ? (
                      <div className="flex justify-between gap-2">
                        <dt>Messages (first reply ≤48h)</dt>
                        <dd className="shrink-0 font-medium text-gray-900">
                          {responseMetrics.messagePercent}% ({responseMetrics.counts.messages.met}/
                          {responseMetrics.counts.messages.total})
                        </dd>
                      </div>
                    ) : null}
                    {responseMetrics.applicationPercent != null ? (
                      <div className="flex justify-between gap-2">
                        <dt>Applications (decision ≤7d)</dt>
                        <dd className="shrink-0 font-medium text-gray-900">
                          {responseMetrics.applicationPercent}% ({responseMetrics.counts.applications.met}/
                          {responseMetrics.counts.applications.total})
                        </dd>
                      </div>
                    ) : null}
                    {responseMetrics.ratingPercent != null ? (
                      <div className="flex justify-between gap-2">
                        <dt>Ratings (≤14d after accept)</dt>
                        <dd className="shrink-0 font-medium text-gray-900">
                          {responseMetrics.ratingPercent}% ({responseMetrics.counts.ratings.met}/
                          {responseMetrics.counts.ratings.total})
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  No scored activity yet. When you message tenants, decide on unlocked applications, and rate
                  accepted tenants (after the rating window closes), your responsiveness score will appear here.
                </p>
              )}
            </Card>

            <Card title="Profile Completion">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Profile Completion</span>
                <span className="text-gray-900">95%</span>
              </div>
              <div className="mt-4 h-2 rounded-full bg-gray-200">
                <div className="h-2 w-[95%] rounded-full bg-gray-900" />
              </div>
              <p className="mt-4 text-xs text-gray-400">Complete your website URL to reach 100%</p>
            </Card>
          </div>
        </div>

      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="mb-6 text-[2rem] font-medium text-gray-900">My Profile</h1>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px]">
        <div className="space-y-4">
          <Card title="Bio">
            <div className="flex items-start gap-4">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="h-12 w-12 rounded-full object-cover"
                />
              ) : (
                <AvatarPlaceholder initials={initials} />
              )}
              <div className="min-w-0 flex-1">
                <h2 className="text-[1.75rem] font-medium text-gray-900">{fullName}</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Add a short headline in your profile.
                </p>
                {(profile?.city || profile?.created_at) && (
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1.5">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      {profile?.city || 'Add your city in your profile.'}
                    </span>
                    {profile?.created_at ? (
                      <span className="inline-flex items-center gap-1.5">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                        </svg>
                        Member since {new Date(profile.created_at).getFullYear()}
                      </span>
                    ) : null}
                  </div>
                )}
              </div>
            </div>
            <p className="mt-5 max-w-2xl text-sm leading-8 text-gray-700">
              {profile?.bio && profile.bio.trim().length > 0
                ? profile.bio
                : 'Add a short introduction so landlords can get to know you better.'}
            </p>
            <Link
              to="/account/edit/bio"
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Edit
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </Card>

          <Card title="Rental History">
            {questionnaireAnswers && (
              getTenantQuestionnaireChoiceLabel('previous_landlord_duration', questionnaireAnswers.previous_landlord_duration as string) ||
              getTenantQuestionnaireChoiceLabel('late_fees_last_two_years', questionnaireAnswers.late_fees_last_two_years as string) ||
              getTenantQuestionnaireChoiceLabel('late_frequency_reported', questionnaireAnswers.late_frequency_reported as string) ||
              getTenantQuestionnaireChoiceLabel('eviction_history', questionnaireAnswers.eviction_history as string)
            ) ? (
              <div className="space-y-4">
                <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                  {getTenantQuestionnaireChoiceLabel('previous_landlord_duration', questionnaireAnswers?.previous_landlord_duration as string) && (
                    <div>
                      <p className="text-sm text-gray-500">Time at previous landlord</p>
                      <p className="mt-1 text-sm text-gray-900">{getTenantQuestionnaireChoiceLabel('previous_landlord_duration', questionnaireAnswers?.previous_landlord_duration as string)}</p>
                    </div>
                  )}
                  {getTenantQuestionnaireChoiceLabel('late_fees_last_two_years', questionnaireAnswers?.late_fees_last_two_years as string) && (
                    <div>
                      <p className="text-sm text-gray-500">Late fees (last 2 years)</p>
                      <p className="mt-1 text-sm text-gray-900">{getTenantQuestionnaireChoiceLabel('late_fees_last_two_years', questionnaireAnswers?.late_fees_last_two_years as string)}</p>
                    </div>
                  )}
                  {getTenantQuestionnaireChoiceLabel('late_frequency_reported', questionnaireAnswers?.late_frequency_reported as string) && (
                    <div>
                      <p className="text-sm text-gray-500">Late payment frequency</p>
                      <p className="mt-1 text-sm text-gray-900">{getTenantQuestionnaireChoiceLabel('late_frequency_reported', questionnaireAnswers?.late_frequency_reported as string)}</p>
                    </div>
                  )}
                  {getTenantQuestionnaireChoiceLabel('eviction_history', questionnaireAnswers?.eviction_history as string) && (
                    <div>
                      <p className="text-sm text-gray-500">Eviction history</p>
                      <p className="mt-1 text-sm text-gray-900">{getTenantQuestionnaireChoiceLabel('eviction_history', questionnaireAnswers?.eviction_history as string)}</p>
                    </div>
                  )}
                </div>
                <Link
                  to="/account/edit/rental-history"
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Edit
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Add your rental history to help landlords assess your reliability.</p>
                <Link
                  to="/account/edit/rental-history"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Add rental history
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </Card>

          <Card title="Employment History">
            {getTenantQuestionnaireChoiceLabel('employment_duration', questionnaireAnswers?.employment_duration as string) ? (
              <div>
                <div>
                  <p className="text-sm text-gray-500">Employment duration</p>
                  <p className="mt-1 text-sm text-gray-900">{getTenantQuestionnaireChoiceLabel('employment_duration', questionnaireAnswers?.employment_duration as string)}</p>
                </div>
                <Link
                  to="/account/edit/employment"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Edit
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Add your employment history to help landlords assess stability.</p>
                <Link
                  to="/account/edit/employment"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Add employment history
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </Card>

          <Card title="Income">
            {typeof questionnaireAnswers?.monthly_income === 'number' && questionnaireAnswers.monthly_income > 0 ? (
              <div>
                <div>
                  <p className="text-sm text-gray-500">Monthly income</p>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
                      questionnaireAnswers.monthly_income,
                    )}
                  </p>
                </div>
                <Link
                  to="/account/edit/income"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Edit
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">
                  Add your monthly income to improve affordability matching.
                </p>
                <Link
                  to="/account/edit/income"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Add income
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </Card>

          <Card title="Tenant Questionnaire">
            <p className="text-sm text-gray-500">
              Update the answers we use for match scoring (including lifestyle and policy fit).
            </p>
            <Link
              to="/tenant-questionnaire"
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
            >
              Edit questionnaire
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </Card>

          <Card title="Lease Preferences">
            {tenantPrefs && hasTenantLeasePreferencesData(tenantPrefs) ? (
              <div className="space-y-4">
                <TenantLeasePreferencesDisplay prefs={tenantPrefs} />
                <Link
                  to="/account/edit/lease-preferences"
                  className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Edit
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-500">Add your lease preferences to improve matching.</p>
                <Link
                  to="/account/edit/lease-preferences"
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Set lease preferences
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              </div>
            )}
          </Card>

          <Card title={TENANT_REVIEWS_CARD_TITLE}>
            <div className="min-w-0 flex-1">
              <p className="text-sm text-gray-500">{TENANT_REVIEWS_DESCRIPTION_AS_TENANT}</p>
              {landlordReviewsAboutMe.length === 0 ? (
                <p className="mt-4 text-sm text-gray-500">No reviews yet.</p>
              ) : (
                <>
                  <ul className="mt-4 space-y-0">
                    {landlordReviewsPreview.map((row) => {
                      const landlordName = row.landlord?.display_name?.trim() || 'Landlord'
                      return (
                        <li
                          key={row.id}
                          className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                        >
                          <TenantReviewListRowContent
                            authorLabel={landlordName}
                            createdAtIso={row.created_at}
                            rating={row.rating}
                            propertyName={row.property_name}
                            propertyAddress={row.property_address}
                            comment={row.comment}
                          />
                        </li>
                      )
                    })}
                  </ul>
                  {landlordReviewsAboutMe.length > landlordReviewsPreview.length ? (
                    <Link
                      to="/account/reviews"
                      className="mt-3 inline-flex text-sm font-medium text-gray-800 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
                    >
                      View all {landlordReviewsAboutMe.length} reviews
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Application Status">
            <UniversalApplicationStatusFields
              statusLabel={universalStatusLabel}
              validUntilText={validUntilText}
              remainingText={remainingText}
              remainingBarWidthPct={remainingBarWidthPct}
              isUniversalActive={isUniversalActive}
              action={
                <Link
                  to="/applications/apply"
                  className={`${UNIVERSAL_APPLICATION_STATUS_ACTION_CLASS} hover:bg-gray-800`}
                >
                  <span>{isUniversalActive ? 'Update rental application' : 'Start rental application'}</span>
                  <svg className="h-4 w-4 shrink-0 opacity-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              }
            />
          </Card>

          <VerificationStatusCard />

          <Card title="Profile Stats">
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Profile Views</span>
                <span className="text-gray-900">0</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Response Rate</span>
                <span className="text-gray-900">—</span>
              </div>
            </div>
          </Card>
        </div>

        {photoPreviewOpen && profile?.avatar_url && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setPhotoPreviewOpen(false)}
          >
            <button
              type="button"
              onClick={() => setPhotoPreviewOpen(false)}
              className="absolute right-4 top-4 rounded-full bg-white/90 p-2 text-gray-600 hover:bg-white"
              aria-label="Close"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={profile.avatar_url}
              alt={fullName}
              className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>

    </div>
  )
}
