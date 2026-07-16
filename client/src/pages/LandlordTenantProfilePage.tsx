import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { TenantAvatar } from '../components/TenantAvatar'
import {
  TENANT_LANDLORD_REVIEWS_PREVIEW_COUNT,
  TENANT_REVIEWS_CARD_TITLE,
  TENANT_REVIEWS_DESCRIPTION_AS_LANDLORD,
  TENANT_REVIEW_PRIMARY_BUTTON_CLASSNAME,
  TenantReviewListRowContent,
} from '../components/TenantReviewDisplay'
import { TenantRentScoreBreakdownDialog } from '../components/TenantRentScoreBreakdownDialog'
import { UniversalApplicationStatusFields } from '../components/UniversalApplicationStatusFields'
import { TenantReviewEditDialog } from '../components/TenantReviewEditDialog'
import { BankVerificationCard, type PlaidVerificationRow } from '../components/BankVerificationCard'
import { useAuth } from '../lib/useAuth'
import { safeInternalPath } from '../lib/safeInternalPath'
import { supabase } from '../lib/supabase'
import StripeCheckoutModal from '../components/StripeCheckoutModal'
import { stripeConfigured } from '../lib/stripe'
import { fetchLandlordTenantUniversalApplication } from '../lib/matchesApi'
import {
  computeUniversalApplicationDisplay,
  parseUniversalApplicationRecord,
  universalApplicationRpcRows,
  type UniversalApplicationRecord,
} from '../lib/universalApplicationDisplay'
import {
  computeTenantRentScoreFromDimensions,
  dimensionsFromTenantQuestionnaireRow,
  type TenantRentScoreDimensions,
} from '../lib/tenantRentScore'
import { getTenantQuestionnaireChoiceLabel } from '../lib/tenantQuestionnaire'
import {
  hasTenantLeasePreferencesData,
  TenantLeasePreferencesDisplay,
} from '../components/TenantLeasePreferencesDisplay'

const APPLICATION_ID_PARAM_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/** Matches tenant Account page card chrome (title + padding). */
function ProfileContentCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold tracking-tight text-gray-900">{title}</h2>
      {children}
    </section>
  )
}

function LockedProfileSection({ title }: { title: string }) {
  return (
    <ProfileContentCard title={title}>
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center">
        <p className="text-sm text-gray-600">Unlock full profile to view this section.</p>
      </div>
    </ProfileContentCard>
  )
}

type TenantProfileReviewRow = {
  id: string
  landlord_id: string
  rating: number
  comment: string | null
  property_name: string | null
  property_address: string | null
  created_at: string
  landlord?: { display_name: string | null } | null
}

function normalizeProfileReviews(rows: unknown): TenantProfileReviewRow[] {
  const list = (rows ?? []) as TenantProfileReviewRow[]
  return list.map((r) => ({
    ...r,
    landlord: Array.isArray(r.landlord) ? r.landlord[0] ?? null : r.landlord ?? null,
  }))
}

export function LandlordTenantProfilePage() {
  const { user } = useAuth()
  const { id = '1' } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const [acceptModalOpen, setAcceptModalOpen] = useState(false)
  const [declineModalOpen, setDeclineModalOpen] = useState(false)
  const [profile, setProfile] = useState<{
    display_name: string | null
    bio: string | null
    city: string | null
    avatar_url: string | null
    created_at: string | null
  } | null>(null)
  const [prefs, setPrefs] = useState<{
    move_in_date: string | null
    lease_length_months: number | null
    min_budget_cents: number | null
    max_budget_cents: number | null
    has_pets: boolean | null
    living_situation: string | null
  } | null>(null)
  const [tenantRentScore, setTenantRentScore] = useState<number | null>(null)
  const [tenantRentDimensions, setTenantRentDimensions] = useState<TenantRentScoreDimensions | null>(null)
  const [tenantRentBreakdownOpen, setTenantRentBreakdownOpen] = useState(false)
  const [tenantQuestionnaireAnswers, setTenantQuestionnaireAnswers] = useState<Record<string, unknown> | null>(null)
  const [pendingApplicationId, setPendingApplicationId] = useState<string | null>(null)
  const [applicationPropertyId, setApplicationPropertyId] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)
  const [declining, setDeclining] = useState(false)
  const [undoingDecline, setUndoingDecline] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [declineError, setDeclineError] = useState<string | null>(null)
  const [undoDeclineError, setUndoDeclineError] = useState<string | null>(null)
  const [loadedApplicationStatus, setLoadedApplicationStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const [pendingUnlockedAt, setPendingUnlockedAt] = useState<string | null>(null)
  const [messageThreadId, setMessageThreadId] = useState<string | null>(null)
  const [unlockPayModalOpen, setUnlockPayModalOpen] = useState(false)
  const [unlockCheckoutOpen, setUnlockCheckoutOpen] = useState(false)
  const [unlockClientSecret, setUnlockClientSecret] = useState<string | null>(null)
  const [unlockStarting, setUnlockStarting] = useState(false)
  const [unlockPayError, setUnlockPayError] = useState<string | null>(null)
  const [tenantReviewsList, setTenantReviewsList] = useState<TenantProfileReviewRow[]>([])
  const [profileApplicationId, setProfileApplicationId] = useState<string | null>(null)
  const [reviewListingCtx, setReviewListingCtx] = useState<{
    property_name: string
    property_address: string
  } | null>(null)
  const [reviewEditOpen, setReviewEditOpen] = useState(false)
  const [tenantUniversalApplication, setTenantUniversalApplication] = useState<UniversalApplicationRecord | null>(null)
  const [tenantScreening, setTenantScreening] = useState<{
    report_status: string | null
    background_pass: boolean | null
    income_pass: boolean | null
    created_at: string
  } | null>(null)
  const [tenantBankVerification, setTenantBankVerification] = useState<PlaidVerificationRow | null>(null)
  type LandlordTenantApplicationRow = {
    id: string
    status: string
    unlocked_at: string | null
    property_id: string
    created_at: string
    property: {
      landlord_id: string
      title: string | null
      address_line1: string
      city: string
      state: string | null
      monthly_rent_cents: number | null
    } | null
  }
  const [landlordTenantApplications, setLandlordTenantApplications] = useState<LandlordTenantApplicationRow[]>([])

  const tenant = {
    id,
    name: profile?.display_name?.trim() || 'Tenant',
    subtitle: profile?.city ? profile.city : '',
    tenantScore: tenantRentScore,
    tags: [] as string[],
    creditScoreRange: '—',
    creditScoreLabel: 'Not provided',
    personalityRatings: [] as { label: string; rating: number }[],
    highlights: [] as string[],
  }
  const status = searchParams.get('status')
  const applicationParamForContext = searchParams.get('application')
  const matchDecisionContext = Boolean(
    applicationParamForContext && APPLICATION_ID_PARAM_RE.test(applicationParamForContext),
  )
  const isAccepted =
    status === 'accepted' || (matchDecisionContext && loadedApplicationStatus === 'approved')
  const isDeclined =
    status === 'declined' || (matchDecisionContext && loadedApplicationStatus === 'rejected')
  const hasUnlockedProfileAccess = useMemo(
    () =>
      landlordTenantApplications.some(
        (r) =>
          r.status === 'approved' ||
          r.status === 'rejected' ||
          (r.status === 'pending' && r.unlocked_at != null),
      ),
    [landlordTenantApplications],
  )
  const canDecidePending =
    matchDecisionContext &&
    loadedApplicationStatus === 'pending' &&
    pendingUnlockedAt != null &&
    Boolean(pendingApplicationId)
  const canUnlockProfile = Boolean(
    pendingApplicationId && loadedApplicationStatus === 'pending' && !pendingUnlockedAt,
  )

  // Confirm the $200 profile-unlock payment on return from Stripe Checkout.
  useEffect(() => {
    const unlock = searchParams.get('unlock')
    const sessionId = searchParams.get('session_id')
    if (unlock === 'cancel') {
      setUnlockPayError('Payment canceled. You can unlock the full profile whenever you\u2019re ready.')
      return
    }
    if (unlock !== 'success' || !sessionId) return
    let active = true
    ;(async () => {
      try {
        const { data: sess } = await supabase.auth.getSession()
        const accessToken = sess.session?.access_token
        if (!accessToken) throw new Error('Your session expired. Please sign in again.')
        const res = await fetch('/api/stripe/landlord/profile-unlock/confirm', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ sessionId }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || 'We could not confirm your payment.')
        }
        if (!active) return
        setPendingUnlockedAt(new Date().toISOString())
        setUnlockPayModalOpen(false)
        const clean = new URLSearchParams()
        const app = searchParams.get('application')
        if (app) clean.set('application', app)
        const qs = clean.toString()
        navigate(`/matches/tenant/${id}${qs ? `?${qs}` : ''}`, { replace: true, state: location.state })
      } catch (e) {
        if (active) setUnlockPayError(e instanceof Error ? e.message : 'Could not confirm payment')
      }
    })()
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, navigate, id])

  const inboxHref = useMemo(() => {
    const params = new URLSearchParams()
    if (messageThreadId) params.set('thread', messageThreadId)
    else params.set('tenant', id)
    params.set('returnTo', `${location.pathname}${location.search}`)
    return `/messages?${params.toString()}`
  }, [messageThreadId, id, location.pathname, location.search])

  const reviewsHref = useMemo(() => {
    const q = new URLSearchParams()
    if (applicationPropertyId) q.set('property', applicationPropertyId)
    if (profileApplicationId) q.set('application', profileApplicationId)
    q.set('returnTo', `${location.pathname}${location.search}`)
    return `/matches/tenant/${encodeURIComponent(id)}/reviews?${q.toString()}`
  }, [id, applicationPropertyId, profileApplicationId, location.pathname, location.search])

  const myTenantReview = useMemo(
    () => (user ? tenantReviewsList.find((r) => r.landlord_id === user.id) ?? null : null),
    [tenantReviewsList, user],
  )

  const profileReviewsPreview = useMemo(
    () => tenantReviewsList.slice(0, TENANT_LANDLORD_REVIEWS_PREVIEW_COUNT),
    [tenantReviewsList],
  )
  const previewShowsMyReview = useMemo(
    () => profileReviewsPreview.some((r) => r.landlord_id === user?.id),
    [profileReviewsPreview, user?.id],
  )

  const tenantUniversalDisplay = useMemo(
    () => computeUniversalApplicationDisplay(tenantUniversalApplication),
    [tenantUniversalApplication],
  )

  const landlordRentalHistory = useMemo(() => {
    const a = tenantQuestionnaireAnswers
    if (!a) {
      return {
        hasAny: false,
        prev: null as string | null,
        lateFees: null as string | null,
        lateFreq: null as string | null,
        eviction: null as string | null,
      }
    }
    const prev = getTenantQuestionnaireChoiceLabel('previous_landlord_duration', a.previous_landlord_duration as string)
    const lateFees = getTenantQuestionnaireChoiceLabel('late_fees_last_two_years', a.late_fees_last_two_years as string)
    const lateFreq = getTenantQuestionnaireChoiceLabel('late_frequency_reported', a.late_frequency_reported as string)
    const eviction = getTenantQuestionnaireChoiceLabel('eviction_history', a.eviction_history as string)
    return {
      hasAny: !!(prev || lateFees || lateFreq || eviction),
      prev,
      lateFees,
      lateFreq,
      eviction,
    }
  }, [tenantQuestionnaireAnswers])

  const landlordEmploymentLabel = useMemo(() => {
    if (!tenantQuestionnaireAnswers) return null
    return getTenantQuestionnaireChoiceLabel(
      'employment_duration',
      tenantQuestionnaireAnswers.employment_duration as string,
    )
  }, [tenantQuestionnaireAnswers])

  const tenantProfileBackKey = `rc.tenantProfile.back.${id}`
  const propertyParam = searchParams.get('property')
  const applicationParam = searchParams.get('application')

  useEffect(() => {
    const path = safeInternalPath((location.state as { from?: string } | null)?.from)
    if (path) {
      try {
        sessionStorage.setItem(tenantProfileBackKey, path)
      } catch {
        /* ignore quota / private mode */
      }
    }
  }, [location.state, tenantProfileBackKey])

  function handleBackFromProfile() {
    const fromState = safeInternalPath((location.state as { from?: string } | null)?.from)
    let fromStored: string | null = null
    try {
      fromStored = safeInternalPath(sessionStorage.getItem(tenantProfileBackKey))
    } catch {
      fromStored = null
    }
    const target = fromState ?? fromStored
    if (target) {
      navigate(target)
      return
    }
    navigate(-1)
  }

  useEffect(() => {
    async function loadTenantContext() {
      if (!user || !id) return

      const [
        { data: profileData },
        { data: prefsData },
        { data: questionnaireData },
        { data: applicationsData },
        { data: ratingsRaw },
        { data: universalRpcRows, error: universalRpcError },
      ] = await Promise.all([
        supabase.from('profiles').select('display_name, bio, city, avatar_url, created_at').eq('id', id).maybeSingle(),
        supabase.from('tenant_preferences').select('move_in_date, lease_length_months, min_budget_cents, max_budget_cents, has_pets, living_situation').eq('user_id', id).maybeSingle(),
        supabase
          .from('tenant_questionnaire')
          .select(
            'affordability_score, stability_score, payment_risk_score, lifestyle_score, space_fit_score, answers',
          )
          .eq('user_id', id)
          .maybeSingle(),
        supabase
          .from('applications')
          .select(
            'id, status, unlocked_at, property_id, created_at, property:property_id(landlord_id, title, address_line1, city, state, monthly_rent_cents)',
          )
          .eq('tenant_id', id)
          .in('status', ['pending', 'approved', 'rejected'])
          .order('created_at', { ascending: false }),
        supabase
          .from('tenant_ratings')
          .select(
            'id, landlord_id, rating, comment, property_name, property_address, created_at, landlord:landlord_id(display_name)',
          )
          .eq('tenant_external_id', id)
          .order('created_at', { ascending: false }),
        supabase.rpc('landlord_tenant_universal_application', { p_tenant_id: id }),
      ])

      if (profileData) {
        setProfile({
          display_name: profileData.display_name ?? null,
          bio: profileData.bio ?? null,
          city: profileData.city ?? null,
          avatar_url: profileData.avatar_url ?? null,
          created_at: profileData.created_at ?? null,
        })
      } else {
        setProfile(null)
      }
      if (prefsData) {
        setPrefs({
          move_in_date: prefsData.move_in_date ?? null,
          lease_length_months: prefsData.lease_length_months ?? null,
          min_budget_cents: prefsData.min_budget_cents ?? null,
          max_budget_cents: prefsData.max_budget_cents ?? null,
          has_pets: prefsData.has_pets ?? null,
          living_situation: prefsData.living_situation ?? null,
        })
      } else {
        setPrefs(null)
      }
      if (questionnaireData) {
        const answers = (questionnaireData as { answers?: Record<string, unknown> }).answers ?? {}
        const dims = dimensionsFromTenantQuestionnaireRow(questionnaireData)
        setTenantRentDimensions(dims)
        setTenantRentScore(computeTenantRentScoreFromDimensions(dims))
        setTenantQuestionnaireAnswers(answers)
      } else {
        setTenantRentDimensions(null)
        setTenantRentScore(null)
        setTenantQuestionnaireAnswers(null)
      }

      setTenantReviewsList(normalizeProfileReviews(ratingsRaw))

      let ua: UniversalApplicationRecord | null = null
      const rpcList = universalApplicationRpcRows(universalRpcRows)
      if (!universalRpcError) {
        ua = parseUniversalApplicationRecord(rpcList[0])
      }
      if (ua == null) {
        const { data: uaFallback, error: uaFallbackErr } = await supabase
          .from('universal_applications')
          .select('status, valid_until, created_at')
          .eq('tenant_id', id)
          .order('created_at', { ascending: false })
          .limit(1)
        if (!uaFallbackErr) {
          const list = Array.isArray(uaFallback) ? uaFallback : []
          ua = parseUniversalApplicationRecord(list[0]) ?? null
        }
      }
      if (ua == null) {
        const { data: sessionData } = await supabase.auth.getSession()
        const token = sessionData.session?.access_token
        if (token) {
          try {
            const { universalApplication } = await fetchLandlordTenantUniversalApplication(token, id)
            ua = parseUniversalApplicationRecord(universalApplication) ?? null
          } catch {
            ua = null
          }
        }
      }
      setTenantUniversalApplication(ua)

      const { data: screeningRow } = await supabase
        .from('universal_application_screenings')
        .select('report_status, background_pass, income_pass, created_at')
        .eq('tenant_id', id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setTenantScreening((screeningRow as any) ?? null)

      const { data: bankRow } = await supabase
        .from('plaid_financial_verifications')
        .select(
          'institution_name, accounts_count, income_verified, balances_verified, debts_verified, dti_ratio, identity_verified, last_verified_at',
        )
        .eq('user_id', id)
        .maybeSingle()
      setTenantBankVerification((bankRow as PlaidVerificationRow | null) ?? null)

      const rows = (applicationsData ?? []) as unknown as LandlordTenantApplicationRow[]
      const forLandlord = rows.filter((r) => r.property?.landlord_id === user.id)
      setLandlordTenantApplications(forLandlord)

      const appIdFromUrl =
        applicationParam && APPLICATION_ID_PARAM_RE.test(applicationParam) ? applicationParam : null
      const propertyIdFromUrl =
        propertyParam && APPLICATION_ID_PARAM_RE.test(propertyParam) ? propertyParam : null
      const decisionContext = Boolean(appIdFromUrl)

      let scoped = forLandlord
      if (appIdFromUrl && forLandlord.some((r) => r.id === appIdFromUrl)) {
        scoped = forLandlord.filter((r) => r.id === appIdFromUrl)
      } else if (!appIdFromUrl && propertyIdFromUrl && forLandlord.some((r) => r.property_id === propertyIdFromUrl)) {
        scoped = forLandlord.filter((r) => r.property_id === propertyIdFromUrl)
      }

      function applyReviewCtxFromPropertyRow(row: LandlordTenantApplicationRow | null | undefined) {
        if (row?.property) {
          const p = row.property
          const pn = p.title?.trim() || p.address_line1
          const pa = [p.address_line1, p.city, p.state].filter(Boolean).join(', ')
          setReviewListingCtx({ property_name: pn, property_address: pa })
        } else {
          setReviewListingCtx(null)
        }
      }

      if (decisionContext) {
        const pending = scoped.find((r) => r.status === 'pending')
        const rejected = scoped.find((r) => r.status === 'rejected')
        const approved = scoped.find((r) => r.status === 'approved')
        const display = pending ?? approved ?? rejected

        setProfileApplicationId(display?.id ?? null)

        if (display) {
          setLoadedApplicationStatus(display.status as 'pending' | 'approved' | 'rejected')
        } else {
          setLoadedApplicationStatus(null)
        }

        if (pending) {
          setPendingApplicationId(pending.id)
          setPendingUnlockedAt(pending.unlocked_at ?? null)
          setApplicationPropertyId(pending.property_id)
        } else {
          setPendingApplicationId(null)
          setPendingUnlockedAt(null)
          setApplicationPropertyId(rejected?.property_id ?? display?.property_id ?? null)
        }

        applyReviewCtxFromPropertyRow(display ?? null)
      } else {
        setProfileApplicationId(null)
        setLoadedApplicationStatus(null)

        const lockedPending = forLandlord.find(
          (r) =>
            r.status === 'pending' &&
            (r.unlocked_at == null || String(r.unlocked_at).trim() === ''),
        )

        const propForReviews =
          (propertyIdFromUrl ? forLandlord.find((r) => r.property_id === propertyIdFromUrl) : null) ??
          forLandlord.find((r) => r.status === 'approved') ??
          forLandlord[0] ??
          null

        if (lockedPending) {
          setPendingApplicationId(lockedPending.id)
          setPendingUnlockedAt(null)
          setApplicationPropertyId(lockedPending.property_id)
          applyReviewCtxFromPropertyRow(lockedPending)
        } else {
          setPendingApplicationId(null)
          setPendingUnlockedAt(null)
          setApplicationPropertyId(propForReviews?.property_id ?? null)
          applyReviewCtxFromPropertyRow(propForReviews)
        }
      }

      const { data: thr } = await supabase
        .from('message_threads')
        .select('id')
        .eq('tenant_id', id)
        .eq('landlord_id', user.id)
        .maybeSingle()
      setMessageThreadId(thr?.id ?? null)
    }

    loadTenantContext()
  }, [id, user?.id, propertyParam, applicationParam])

  async function handleAccept() {
    if (!pendingApplicationId || !applicationPropertyId || !user) return
    if (!pendingUnlockedAt) {
      setAcceptError('Unlock this match from Matches before you can accept.')
      return
    }
    setAcceptError(null)
    setAccepting(true)
    try {
      const { error: updateErr } = await supabase
        .from('applications')
        .update({ status: 'approved' })
        .eq('id', pendingApplicationId)

      if (updateErr) throw updateErr

      const { data: existing } = await supabase
        .from('message_threads')
        .select('id')
        .eq('tenant_id', id)
        .eq('landlord_id', user.id)
        .maybeSingle()

      let threadId = existing?.id ?? null
      if (existing) {
        const { error: touchErr } = await supabase
          .from('message_threads')
          .update({
            property_id: applicationPropertyId,
            application_id: pendingApplicationId,
          })
          .eq('id', existing.id)
        if (touchErr) throw touchErr
      } else {
        const { data: inserted, error: insertErr } = await supabase
          .from('message_threads')
          .insert({
            application_id: pendingApplicationId,
            tenant_id: id,
            landlord_id: user.id,
            property_id: applicationPropertyId,
          })
          .select('id')
          .single()
        if (insertErr) throw insertErr
        threadId = inserted?.id ?? null
      }
      setMessageThreadId(threadId)

      setLoadedApplicationStatus('approved')
      setPendingApplicationId(null)
      setAcceptModalOpen(true)
    } catch (e) {
      setAcceptError(e instanceof Error ? e.message : 'Failed to accept tenant')
    } finally {
      setAccepting(false)
    }
  }

  async function handleDecline() {
    if (!pendingApplicationId || !user) return
    if (!pendingUnlockedAt) {
      setDeclineError('Unlock this match from Matches before you can decline.')
      return
    }
    setDeclineError(null)
    setDeclining(true)
    try {
      const { error } = await supabase
        .from('applications')
        .update({ status: 'rejected' })
        .eq('id', pendingApplicationId)

      if (error) throw error

      const appId = pendingApplicationId
      setLoadedApplicationStatus('rejected')
      setPendingApplicationId(null)
      setDeclineModalOpen(false)
      // Keep ?application= in the URL (unlike a bare navigate, which would drop
      // matchDecisionContext and bounce this page into its browse-only mode).
      navigate(`/matches/tenant/${tenant.id}?application=${encodeURIComponent(appId)}`, {
        replace: true,
        state: location.state,
      })
    } catch (e) {
      setDeclineError(e instanceof Error ? e.message : 'Failed to decline this match')
    } finally {
      setDeclining(false)
    }
  }

  async function handleUndoDecline() {
    if (!profileApplicationId) return
    setUndoDeclineError(null)
    setUndoingDecline(true)
    try {
      const { data: prior, error: priorErr } = await supabase
        .from('applications')
        .select('unlocked_at')
        .eq('id', profileApplicationId)
        .eq('status', 'rejected')
        .maybeSingle()
      if (priorErr) throw priorErr
      const { data: updated, error } = await supabase
        .from('applications')
        .update({
          status: 'pending',
          ...(prior?.unlocked_at ? { unlocked_at: prior.unlocked_at } : {}),
        })
        .eq('id', profileApplicationId)
        .eq('status', 'rejected')
        .select('id')
      if (error) throw error
      if (!updated?.length) {
        throw new Error('This application could not be restored. It may have already changed.')
      }

      setLoadedApplicationStatus('pending')
      setPendingApplicationId(profileApplicationId)
      setPendingUnlockedAt(prior?.unlocked_at ?? null)
      navigate(`/matches/tenant/${tenant.id}?application=${encodeURIComponent(profileApplicationId)}`, {
        replace: true,
        state: location.state,
      })
    } catch (e) {
      setUndoDeclineError(e instanceof Error ? e.message : 'Could not restore application')
    } finally {
      setUndoingDecline(false)
    }
  }

  function handleAcceptModalGotIt() {
    setAcceptModalOpen(false)
    const appId = profileApplicationId
    const qs = appId ? `?application=${encodeURIComponent(appId)}` : ''
    navigate(`/matches/tenant/${tenant.id}${qs}`, { replace: true, state: location.state })
  }

  // Hand off to Stripe Checkout for the $200 full-profile access fee. The tenant's
  // profile is unlocked only after the payment is confirmed on return.
  async function handleConfirmProfileUnlock() {
    if (!pendingApplicationId || !user) return
    setUnlockPayError(null)
    setUnlockStarting(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const accessToken = sess.session?.access_token
      if (!accessToken) throw new Error('Your session expired. Please sign in again.')
      const res = await fetch('/api/stripe/landlord/profile-unlock/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ applicationId: pendingApplicationId }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || 'Could not start checkout. Please try again.')
      }
      const json = (await res.json()) as { clientSecret?: string; demo?: boolean }

      // Demo bypass (dev only): profile unlocked server-side, no payment.
      if (json.demo) {
        setPendingUnlockedAt(new Date().toISOString())
        setUnlockPayModalOpen(false)
        const qs = pendingApplicationId ? `?application=${encodeURIComponent(pendingApplicationId)}` : ''
        navigate(`/matches/tenant/${id}${qs}`, { replace: true, state: location.state })
        return
      }

      if (!json.clientSecret) throw new Error('Could not start checkout. Please try again.')
      if (!stripeConfigured) {
        throw new Error('Payments are not configured yet. Please try again later.')
      }
      setUnlockClientSecret(json.clientSecret)
      setUnlockPayModalOpen(false)
      setUnlockCheckoutOpen(true)
    } catch (err) {
      setUnlockPayError(err instanceof Error ? err.message : 'Could not start checkout. Please try again.')
    } finally {
      setUnlockStarting(false)
    }
  }

  return (
    <div className="flex min-h-full flex-col px-4 py-4">
      <div className="w-full">
        <button
          type="button"
          onClick={handleBackFromProfile}
          className="mb-7 inline-flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-start">
              <div className="min-w-0 space-y-4">
                <ProfileContentCard title="Bio">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 flex-1 items-start gap-4">
                      <TenantAvatar name={tenant.name} avatarUrl={profile?.avatar_url ?? null} sizeClass="h-12 w-12" textClass="text-xs" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                          <h2 className="text-[1.75rem] font-medium text-gray-900">{tenant.name}</h2>
                          {matchDecisionContext && isAccepted ? (
                            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                              Accepted
                            </span>
                          ) : null}
                          {matchDecisionContext && isDeclined ? (
                            <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-medium text-white">
                              Declined
                            </span>
                          ) : null}
                          {matchDecisionContext && !isAccepted && !isDeclined && loadedApplicationStatus === 'pending' ? (
                            <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                              Pending
                            </span>
                          ) : null}
                        </div>
                        {(profile?.city || profile?.created_at) ? (
                          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-gray-500">
                            <span className="inline-flex items-center gap-1.5">
                              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.828 0l-4.243-4.243a8 8 0 1111.314 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                              </svg>
                              {profile?.city?.trim() || 'City not listed'}
                            </span>
                            {profile?.created_at ? (
                              <span className="inline-flex items-center gap-1.5">
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-11 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v11a2 2 0 002 2z" />
                                </svg>
                                Member since {new Date(profile.created_at).getFullYear()}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-center rounded-lg border border-gray-100 bg-gray-50/80 px-5 py-3 sm:self-start">
                      <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                        <span>Tenant Score</span>
                        {tenant.tenantScore != null ? (
                          <button
                            type="button"
                            onClick={() => setTenantRentBreakdownOpen(true)}
                            className="rounded-full p-0.5 text-gray-400 hover:bg-gray-200/80 hover:text-gray-600"
                            aria-label="Show score breakdown"
                            title="See breakdown"
                          >
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </button>
                        ) : (
                          <span className="inline-flex text-gray-300" aria-hidden>
                            <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-emerald-400 text-xl font-medium text-gray-900">
                        {tenant.tenantScore != null ? tenant.tenantScore : '—'}
                      </div>
                    </div>
                  </div>
                  <p className="mt-5 max-w-2xl text-sm leading-8 text-gray-700">
                    {profile?.bio && profile.bio.trim().length > 0
                      ? profile.bio
                      : 'This tenant has not added a bio yet.'}
                  </p>
                </ProfileContentCard>

                {hasUnlockedProfileAccess ? (
                  <>
                    <ProfileContentCard title="Rental History">
                      {landlordRentalHistory.hasAny ? (
                        <div className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                          {landlordRentalHistory.prev ? (
                            <div>
                              <p className="text-sm text-gray-500">Time at previous landlord</p>
                              <p className="mt-1 text-sm text-gray-900">{landlordRentalHistory.prev}</p>
                            </div>
                          ) : null}
                          {landlordRentalHistory.lateFees ? (
                            <div>
                              <p className="text-sm text-gray-500">Late fees (last 2 years)</p>
                              <p className="mt-1 text-sm text-gray-900">{landlordRentalHistory.lateFees}</p>
                            </div>
                          ) : null}
                          {landlordRentalHistory.lateFreq ? (
                            <div>
                              <p className="text-sm text-gray-500">Late payment frequency</p>
                              <p className="mt-1 text-sm text-gray-900">{landlordRentalHistory.lateFreq}</p>
                            </div>
                          ) : null}
                          {landlordRentalHistory.eviction ? (
                            <div>
                              <p className="text-sm text-gray-500">Eviction history</p>
                              <p className="mt-1 text-sm text-gray-900">{landlordRentalHistory.eviction}</p>
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Not provided.</p>
                      )}
                    </ProfileContentCard>

                    <ProfileContentCard title="Employment History">
                      {landlordEmploymentLabel ? (
                        <div>
                          <p className="text-sm text-gray-500">Employment duration</p>
                          <p className="mt-1 text-sm text-gray-900">{landlordEmploymentLabel}</p>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">Not provided.</p>
                      )}
                    </ProfileContentCard>

                    <ProfileContentCard title="Lease Preferences">
                      {prefs && hasTenantLeasePreferencesData(prefs) ? (
                        <TenantLeasePreferencesDisplay prefs={prefs} />
                      ) : (
                        <p className="text-sm text-gray-500">Not provided</p>
                      )}
                    </ProfileContentCard>
                  </>
                ) : (
                  <>
                    <LockedProfileSection title="Rental History" />
                    <LockedProfileSection title="Employment History" />
                    <LockedProfileSection title="Lease Preferences" />
                  </>
                )}

              {hasUnlockedProfileAccess ? (
                <ProfileContentCard title={TENANT_REVIEWS_CARD_TITLE}>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-500">{TENANT_REVIEWS_DESCRIPTION_AS_LANDLORD}</p>
                    {tenantReviewsList.length === 0 ? (
                      <p className="mt-4 text-sm text-gray-500">No reviews yet.</p>
                    ) : (
                      <ul className="mt-4 space-y-0">
                        {profileReviewsPreview.map((row) => {
                          const isMine = user?.id === row.landlord_id
                          const name = isMine
                            ? 'You'
                            : row.landlord?.display_name?.trim() || 'Landlord'
                          return (
                            <li
                              key={row.id}
                              className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0"
                            >
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0 flex-1">
                                  <TenantReviewListRowContent
                                    authorLabel={name}
                                    createdAtIso={row.created_at}
                                    rating={row.rating}
                                    propertyName={row.property_name}
                                    propertyAddress={row.property_address}
                                    comment={row.comment}
                                  />
                                </div>
                                {isMine ? (
                                  <button
                                    type="button"
                                    onClick={() => setReviewEditOpen(true)}
                                    className={`shrink-0 self-start ${TENANT_REVIEW_PRIMARY_BUTTON_CLASSNAME}`}
                                  >
                                    Edit
                                  </button>
                                ) : null}
                              </div>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                    {tenantReviewsList.length > profileReviewsPreview.length ? (
                      <Link
                        to={reviewsHref}
                        className="mt-3 inline-flex text-sm font-medium text-gray-800 underline decoration-gray-300 underline-offset-2 hover:text-gray-900"
                      >
                        View all {tenantReviewsList.length} reviews
                      </Link>
                    ) : null}
                    {!myTenantReview ? (
                      <button
                        type="button"
                        onClick={() => setReviewEditOpen(true)}
                        className={`mt-3 inline-flex w-full sm:w-auto ${TENANT_REVIEW_PRIMARY_BUTTON_CLASSNAME}`}
                      >
                        Write a review
                      </button>
                    ) : !previewShowsMyReview ? (
                      <button
                        type="button"
                        onClick={() => setReviewEditOpen(true)}
                        className={`mt-3 inline-flex w-full sm:w-auto ${TENANT_REVIEW_PRIMARY_BUTTON_CLASSNAME}`}
                      >
                        Edit your review
                      </button>
                    ) : null}
                  </div>
                </ProfileContentCard>
              ) : (
                <LockedProfileSection title={TENANT_REVIEWS_CARD_TITLE} />
              )}
              </div>

              <div className="space-y-4 lg:sticky lg:top-4">
                <ProfileContentCard title="Application Status">
                  <UniversalApplicationStatusFields
                    statusLabel={tenantUniversalDisplay.statusLabel}
                    validUntilText={tenantUniversalDisplay.validUntilText}
                    remainingText={tenantUniversalDisplay.remainingText}
                    remainingBarWidthPct={tenantUniversalDisplay.remainingBarWidthPct}
                    isUniversalActive={tenantUniversalDisplay.isUniversalActive}
                    showTimeline={false}
                  />

                  <div className="mt-4 grid gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-600">Income</span>
                      <span className="font-medium text-gray-900">
                        {tenantScreening?.income_pass == null ? '—' : tenantScreening.income_pass ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-gray-600">Background</span>
                      <span className="font-medium text-gray-900">
                        {tenantScreening?.background_pass == null ? '—' : tenantScreening.background_pass ? 'Pass' : 'Fail'}
                      </span>
                    </div>
                  </div>
                </ProfileContentCard>

                <BankVerificationCard verification={tenantBankVerification} />

                <div className="space-y-2">
                  {hasUnlockedProfileAccess ? (
                    <>
                      <Link
                        to={inboxHref}
                        className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4-.8L3 20l1.385-3.231C3.512 15.477 3 13.79 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        Go to Inbox
                      </Link>
                      <Link
                        to={`/matches?tenant=${encodeURIComponent(id)}`}
                        className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h10M7 12h10M7 17h10M4 7h.01M4 12h.01M4 17h.01" />
                        </svg>
                        View all matches
                      </Link>
                    </>
                  ) : null}
                  {canUnlockProfile ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setUnlockPayError(null)
                          setUnlockPayModalOpen(true)
                        }}
                        className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm-7 9h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
                        </svg>
                        Unlock full profile
                      </button>
                      <p className="text-center text-xs text-gray-400">One-time payment • Secure checkout via Stripe</p>
                    </>
                  ) : !hasUnlockedProfileAccess ? (
                    <Link
                      to="/matches"
                      className="inline-flex w-full min-h-[44px] items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Back to matches
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>

            {!isAccepted && !isDeclined && canDecidePending ? (
              <div className="mt-5 space-y-3">
                {acceptError ? (
                  <p className="text-sm text-red-600">{acceptError}</p>
                ) : null}
                <div className="flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setDeclineModalOpen(true)}
                    disabled={declining}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Decline match
                  </button>

                  <button
                    type="button"
                    onClick={handleAccept}
                    disabled={accepting}
                    className="inline-flex items-center gap-2 rounded-lg btn-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60"
                  >
                    {accepting ? (
                      'Accepting…'
                    ) : (
                      <>
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Accept Tenant
                      </>
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {matchDecisionContext && isDeclined ? (
              <div className="mt-5 space-y-3">
                {undoDeclineError ? (
                  <p className="text-sm text-red-600">{undoDeclineError}</p>
                ) : null}
                <button
                  type="button"
                  onClick={handleUndoDecline}
                  disabled={undoingDecline}
                  className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  {undoingDecline ? 'Restoring…' : 'Undo decline'}
                </button>
              </div>
            ) : null}
      </div>


      {acceptModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[680px] rounded-[28px] bg-white px-8 py-7 shadow-2xl">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-white">
              <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <h2 className="mt-5 text-center text-[2rem] font-medium text-gray-900">Tenant Accepted!</h2>
            <p className="mx-auto mt-3 max-w-[440px] text-center text-sm leading-7 text-gray-600">
              You&apos;ve accepted this tenant. They&apos;ll be added to your inbox so you can start a
              conversation.
            </p>
            <section className="mt-6 rounded-2xl border border-gray-200 bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <TenantAvatar name={tenant.name} avatarUrl={profile?.avatar_url ?? null} />

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="text-[1.35rem] font-medium text-gray-900">{tenant.name}</h3>
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">
                        Accepted
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600">{tenant.subtitle}</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tenant.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-500">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="min-w-[112px] rounded-xl border border-gray-200 bg-white px-4 py-3 text-center">
                  <div className="flex items-center justify-center gap-1 text-xs text-gray-500">
                    <span>Tenant Score</span>
                    {tenant.tenantScore != null ? (
                      <button
                        type="button"
                        onClick={() => setTenantRentBreakdownOpen(true)}
                        className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="Show score breakdown"
                        title="See breakdown"
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </button>
                    ) : (
                      <span className="inline-flex text-gray-300" aria-hidden>
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </span>
                    )}
                  </div>
                  <div className="mx-auto mt-2 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-emerald-400 text-xl font-medium text-gray-900">
                    {tenant.tenantScore != null ? tenant.tenantScore : '—'}
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-5 rounded-2xl bg-gray-50 px-5 py-5">
              <h3 className="text-[1.35rem] font-medium text-gray-900">What happens next?</h3>
              <div className="mt-5 space-y-5">
                {[
                  {
                    title: `${tenant.name} will be notified of your acceptance`,
                    description: "They'll receive an email and in-app notification",
                  },
                  {
                    title: 'Start a conversation in your inbox',
                    description: 'Discuss next steps, schedule viewings, and finalize details',
                  },
                  {
                    title: 'Complete the rental agreement',
                    description: 'Use our secure platform or your preferred method',
                  },
                ].map((step, index) => (
                  <div key={step.title} className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                        index < 2 ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{step.title}</p>
                      <p className="mt-1 text-sm text-gray-500">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <div className="mt-6 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setAcceptModalOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-10 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Undo
              </button>
              <button
                type="button"
                onClick={handleAcceptModalGotIt}
                className="rounded-lg btn-primary px-10 py-3 text-sm font-medium text-white"
              >
                Got it!
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {unlockPayModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[320px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Unlock Tenant Profile</h2>
              <button
                type="button"
                onClick={() => {
                  setUnlockPayError(null)
                  setUnlockPayModalOpen(false)
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close unlock modal"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-5 py-4">
              <div className="text-center">
                <p className="text-[2.25rem] font-medium leading-none text-gray-900">$200</p>
                <p className="mt-2 text-sm text-gray-500">One-time full-profile access</p>
              </div>

              <p className="mt-5 text-sm leading-7 text-gray-600">
                View this tenant&apos;s full profile — background check, credit report, rental history, and contact info.
              </p>

              <ul className="mt-5 space-y-2 text-sm text-gray-600">
                {[
                  'Full background check',
                  'Credit report',
                  'Complete rental history',
                  'Direct contact information',
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <svg className="mt-1 h-4 w-4 flex-shrink-0 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              {unlockPayError ? <p className="mt-4 text-sm text-red-600">{unlockPayError}</p> : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockPayError(null)
                    setUnlockPayModalOpen(false)
                  }}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmProfileUnlock}
                  disabled={unlockStarting}
                  className="inline-flex items-center justify-center gap-2 rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white disabled:opacity-60"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c1.657 0 3-1.343 3-3V7a3 3 0 10-6 0v1c0 1.657 1.343 3 3 3zm-7 9h14a2 2 0 002-2v-5a2 2 0 00-2-2H5a2 2 0 00-2 2v5a2 2 0 002 2z" />
                  </svg>
                  {unlockStarting ? 'Processing…' : 'Continue to payment'}
                </button>
              </div>

              <p className="mt-4 text-center text-[11px] leading-5 text-gray-400">
                Your payment is processed through Stripe and is non-refundable once profile is viewed.
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <StripeCheckoutModal
        open={unlockCheckoutOpen}
        onClose={() => {
          setUnlockCheckoutOpen(false)
          setUnlockClientSecret(null)
        }}
        clientSecret={unlockClientSecret}
        title="Unlock full tenant profile"
      />

      <TenantRentScoreBreakdownDialog
        open={tenantRentBreakdownOpen && tenant.tenantScore != null}
        onClose={() => setTenantRentBreakdownOpen(false)}
        overallScore={tenant.tenantScore ?? 0}
        dimensions={tenantRentDimensions}
        variant="landlord"
      />

      <TenantReviewEditDialog
        open={reviewEditOpen}
        onClose={() => setReviewEditOpen(false)}
        tenantExternalId={id}
        tenantDisplayName={tenant.name}
        propertyCtx={reviewListingCtx}
        existingReview={
          myTenantReview
            ? {
                rating: myTenantReview.rating,
                comment: myTenantReview.comment,
                property_name: myTenantReview.property_name,
                property_address: myTenantReview.property_address,
              }
            : null
        }
        onSaved={async () => {
          const { data: ratingsRaw } = await supabase
            .from('tenant_ratings')
            .select(
              'id, landlord_id, rating, comment, property_name, property_address, created_at, landlord:landlord_id(display_name)',
            )
            .eq('tenant_external_id', id)
            .order('created_at', { ascending: false })
          setTenantReviewsList(normalizeProfileReviews(ratingsRaw))
        }}
      />

      {declineModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 py-8">
          <div className="w-full max-w-[320px] overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-gray-200 px-5 py-4">
              <h2 className="text-[1.35rem] font-medium text-gray-900">Decline match</h2>
            </div>

            <div className="px-5 py-5">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4c-.77-1.33-2.69-1.33-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z" />
                  </svg>
                </div>

                <div>
                  <p className="text-[1.15rem] font-medium text-gray-900">
                    Are you sure you want to decline this match?
                  </p>
                  <p className="mt-4 text-sm leading-7 text-gray-600">
                    This only affects this application. You can restore it from Your matches if you change your mind.
                    The tenant will be notified.
                  </p>
                </div>
              </div>
              {declineError ? (
                <p className="mt-3 text-sm text-red-600">{declineError}</p>
              ) : null}

              <div className="mt-6 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDeclineModalOpen(false)}
                  disabled={declining}
                  className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDecline}
                  disabled={declining}
                  className="rounded-lg bg-gray-600 px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
                >
                  {declining ? 'Declining…' : 'Yes, Decline'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
