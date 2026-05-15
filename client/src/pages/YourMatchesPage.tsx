import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { formatBedrooms, formatCurrency } from '../lib/propertyDraft'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'
import {
  fetchLandlordMatchCatalog,
  fetchMatchesForTenant,
  fetchMatchesForLandlord,
  type MatchResult,
} from '../lib/matchesApi'
import { TenantRentScoreBreakdownDialog } from '../components/TenantRentScoreBreakdownDialog'
import {
  computeTenantRentScoreFromDimensions,
  dimensionsFromTenantQuestionnaireRow,
  type TenantRentScoreDimensions,
} from '../lib/tenantRentScore'

type MatchCard = {
  id: string
  title: string
  location: string
  price: string
  saved: boolean
  compatibility: string
  tags: string[]
  bedrooms: number
  monthly_rent_cents: number
  amenitiesList: string[]
  landlordId: string
  landlordDisplayName: string | null
  photoUrl: string | null
  photoAlt: string
}

type ProfileRole = 'tenant' | 'landlord'

type LandlordMatchStatus = 'locked' | 'unlocked' | 'accepted' | 'declined'

type LandlordMatchFilter =
  | 'all'
  | 'applications'
  | 'prospects'
  | 'locked'
  | 'unlocked'
  | 'accepted'
  | 'declined'

type LandlordMatchCard = {
  id: string
  applicationId: string | null
  hasApplication: boolean
  /** ISO created_at when this row is tied to an application (for sorting). */
  applicationCreatedAt: string | null
  tenantId: string
  propertyId: string
  listingLabel: string
  name: string
  avatarUrl: string | null
  appliedAgo: string
  status: LandlordMatchStatus
  /** Property-specific score from server catalog; falls back to batch landlord API when absent. */
  matchPreview: MatchResult | null
  /** Present when hasApplication; used to keep unlock state after undo decline and to fix workflow UI. */
  applicationUnlockedAt: string | null
  compatibilitySummary: string
  creditScore: string
  tenantScore: string
  leaseIntent: string
}

const SAVED_IDS_KEY = 'rental-city-saved-matches'

function formatRelativeTime(createdAt: string) {
  const date = new Date(createdAt)
  const diffMs = Date.now() - date.getTime()
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays === 0) return 'Applied today'
  if (diffDays === 1) return 'Applied 1 day ago'
  if (diffDays < 7) return `Applied ${diffDays} days ago`
  return `Applied ${Math.floor(diffDays / 7)} weeks ago`
}

function MatchCardPhoto({ url, alt }: { url: string | null; alt: string }) {
  const [broken, setBroken] = useState(false)
  const show = Boolean(url) && !broken
  return (
    <div className="mb-4 aspect-[16/7] overflow-hidden rounded-lg bg-gray-100">
      {show ? (
        <img
          src={url as string}
          alt={alt}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setBroken(true)}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="text-sm text-gray-500">No photos yet</span>
        </div>
      )}
    </div>
  )
}

/** Tenant `tenant_preferences.lease_length_months` — same shaping as Account lease duration. */
function formatLeaseIntentLabel(months: number | null | undefined): string {
  if (months == null) return '—'
  if (months < 12) return `${months} months`
  if (months >= 24) return `${months / 12}+ years`
  return `${months / 12} year`
}

// Match states: locked (must unlock first), unlocked (can accept or deny), accepted, declined.
// Only an unlocked match can be accepted or denied.
function applicationStatusToMatch(status: string, unlockedAt: string | null): LandlordMatchStatus {
  if (status === 'approved') return 'accepted'
  if (status === 'rejected') return 'declined'
  if (status === 'pending' && unlockedAt) return 'unlocked'
  if (status === 'pending') return 'locked'
  return 'locked'
}

/** Approve/decline/unlock UI: pending + unlocked_at must stay unlocked (e.g. after undo decline). */
function effectiveLandlordWorkflowStatus(match: LandlordMatchCard): LandlordMatchStatus {
  if (
    match.hasApplication &&
    match.status === 'locked' &&
    match.applicationUnlockedAt != null &&
    String(match.applicationUnlockedAt).trim() !== ''
  ) {
    return 'unlocked'
  }
  return match.status
}

/** Deep-link tenant profile to the application row (listing) for this match. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const LANDLORD_MATCH_STATUS_LABEL: Record<LandlordMatchStatus, string> = {
  locked: 'Locked',
  unlocked: 'Unlocked',
  accepted: 'Accepted',
  declined: 'Declined',
}

/** Opens landlord view of tenant profile (browse-only). Unlock / accept / decline stay on Your matches. */
function landlordTenantProfilePath(match: LandlordMatchCard): string {
  return `/matches/tenant/${encodeURIComponent(match.tenantId)}`
}

/** Tenant opens the public-style landlord profile (mirrors landlord → tenant profile link). */
function tenantLandlordProfilePath(landlordId: string, opts?: { propertyId?: string; returnTo?: string }) {
  const q = new URLSearchParams()
  if (opts?.propertyId) q.set('property', opts.propertyId)
  if (opts?.returnTo) q.set('returnTo', opts.returnTo)
  const qs = q.toString()
  return `/matches/landlord/${encodeURIComponent(landlordId)}${qs ? `?${qs}` : ''}`
}

function LandlordAvatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  if (avatarUrl?.trim()) {
    return (
      <img
        src={avatarUrl.trim()}
        alt={`${name} profile photo`}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-black/5"
      />
    )
  }

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[radial-gradient(circle_at_top,_#d6c7ba,_#8a6f5a)] text-xs font-medium text-white">
      {initials}
    </div>
  )
}

function loadSavedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SAVED_IDS_KEY)
    if (!raw) return new Set()
    const arr = JSON.parse(raw) as string[]
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

function saveSavedIds(ids: Set<string>) {
  localStorage.setItem(SAVED_IDS_KEY, JSON.stringify([...ids]))
}

type MatchDimensions = TenantRentScoreDimensions

const DIMENSION_LABELS: { key: keyof MatchDimensions; emoji: string; label: string }[] = [
  { key: 'affordability', emoji: '💰', label: 'Affordability' },
  { key: 'stability', emoji: '🏠', label: 'Stability' },
  { key: 'risk', emoji: '🛡️', label: 'Risk fit' },
  { key: 'lifestyle', emoji: '✨', label: 'Lifestyle' },
  { key: 'policy', emoji: '📋', label: 'Policy' },
]

const DIMENSION_WEIGHTS: Record<keyof MatchDimensions, number> = {
  affordability: 0.35,
  stability: 0.25,
  risk: 0.2,
  lifestyle: 0.1,
  policy: 0.1,
}

// 0 = red, 1 = green (pct is 0–100). Returns bg- and border- class names.
function scoreBarColor(pct: number): { bg: string; border: string } {
  if (pct <= 25) return { bg: 'bg-red-500', border: 'border-red-500' }
  if (pct <= 50) return { bg: 'bg-orange-500', border: 'border-orange-500' }
  if (pct <= 75) return { bg: 'bg-amber-500', border: 'border-amber-500' }
  return { bg: 'bg-emerald-500', border: 'border-emerald-500' }
}

function ScoreBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  const { bg } = scoreBarColor(pct)
  return (
    <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-200">
      <div
        className={`h-full rounded-full transition-[width] ${bg}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function getDimensionContribution(key: keyof MatchDimensions, score: number): number {
  const safe = Number.isFinite(score) ? Math.max(0, Math.min(10, score)) : 0
  return (safe / 10) * (DIMENSION_WEIGHTS[key] * 100)
}

function getDimensionMaxContribution(key: keyof MatchDimensions): number {
  return DIMENSION_WEIGHTS[key] * 100
}

function formatContribution(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function MatchScoreDisplay({
  overall,
  dimensions,
  compact = false,
  showQuestionnaireIncomeHint = true,
}: {
  overall: number
  dimensions: MatchDimensions
  compact?: boolean
  /** When false, skips the nested questionnaire link (required when this block sits inside a profile `Link`). */
  showQuestionnaireIncomeHint?: boolean
}) {
  const overallPct = Math.min(100, Math.max(0, overall))
  const { bg: overallBg, border: overallBorder } = scoreBarColor(overallPct)
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-semibold text-gray-900">{compact ? 'Match' : 'Match score'}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold text-gray-800 ${overallBorder}`}>
          {overall}
        </span>
        <div className="flex-1 min-w-[60px] max-w-[100px] h-2 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-[width] ${overallBg}`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>
      <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
        {DIMENSION_LABELS.map(({ key, emoji, label }) => {
          const score = dimensions[key] ?? 0
          const contribution = getDimensionContribution(key, score)
          const maxContribution = getDimensionMaxContribution(key)
          return (
            <div key={key} className="flex items-center gap-2 text-xs">
              <span className="w-5 text-center shrink-0">{emoji}</span>
              <span className="text-gray-700 min-w-[8rem]">{label}</span>
              <ScoreBar value={contribution} max={maxContribution} />
              <span className="text-gray-500 min-w-[8ch] text-right">
                {formatContribution(contribution)} / {formatContribution(maxContribution)}
              </span>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-gray-500">Bars show weighted contribution to total score.</p>
      {/* Reserve space so card height stays consistent even when this note is not shown. */}
      <div className="mt-2 min-h-[22px]">
        {showQuestionnaireIncomeHint && (dimensions.affordability ?? 0) === 0 ? (
          <p className="text-[11px] text-gray-500">
          Affordability is based on this listing’s rent and your income. Add or update income in the{' '}
          <Link to="/tenant-questionnaire" className="text-emerald-600 hover:underline">questionnaire</Link> if it’s missing.
          </p>
        ) : (
          <div className="h-0 overflow-hidden" aria-hidden />
        )}
      </div>
    </div>
  )
}

export function YourMatchesPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  function initialTenantMatchesTab(sp: URLSearchParams): 'all' | 'saved' | 'applied' {
    const t = sp.get('tab')
    return t === 'saved' || t === 'applied' ? t : 'all'
  }
  const landlordMatchesTenantId = useMemo(() => {
    const raw = searchParams.get('tenant')?.trim()
    if (!raw || !UUID_RE.test(raw)) return null
    return raw
  }, [searchParams])
  const tenantProfileNavState = useMemo(
    () => ({ from: `${location.pathname}${location.search}` }),
    [location.pathname, location.search],
  )
  const { user } = useAuth()
const { role: profileRole, displayName, landlordSurveyCompletedAt, tenantSurveyCompletedAt, loading: roleLoading, refetch: refetchProfile } = useProfileRole(user)
  const [activeTab, setActiveTab] = useState<'all' | 'saved' | 'applied'>(() =>
    initialTenantMatchesTab(searchParams),
  )
  const [bedrooms, setBedrooms] = useState('any')
  const [priceRange, setPriceRange] = useState<[number, number]>([500, 3000])
  const [amenities, setAmenities] = useState({ petFriendly: false, parking: false, laundry: false, gym: false })
  const AMENITY_LABELS: Record<string, string> = {
    pet_friendly: '🐾',
    parking: '🅿️',
    laundry: '🧺',
    gym: '🏋️',
  }
  const [savedIds, setSavedIds] = useState<Set<string>>(loadSavedIds)
  const [applicationIdByPropertyId, setApplicationIdByPropertyId] = useState<Record<string, string>>({})
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set())
  const [hasActiveUniversalApplication, setHasActiveUniversalApplication] = useState<boolean | null>(null)
  const [submissionModal, setSubmissionModal] = useState<{ propertyTitle: string } | null>(null)
  const [landlordProperty, setLandlordProperty] = useState('')
  const [landlordFilter, setLandlordFilter] = useState<LandlordMatchFilter>('all')

  const [tenantMatches, setTenantMatches] = useState<MatchCard[]>([])
  const [landlordMatches, setLandlordMatches] = useState<LandlordMatchCard[]>([])
  const [landlordProperties, setLandlordProperties] = useState<Array<{ id: string; label: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const MATCHES_PAGE_SIZE = 6
  const TENANT_MATCHES_PAGE_SIZE = 6
  /** Eligible tenant ↔ property matches (questionnaire complete), by match score */
  const MAX_TENANT_TOP_MATCHES = 10
  const [landlordPage, setLandlordPage] = useState(1)
  const [tenantPage, setTenantPage] = useState(1)
  const [tenantOverallScore, setTenantOverallScore] = useState<number | null>(null)
  const [tenantDimensionScores, setTenantDimensionScores] = useState<MatchDimensions | null>(null)
  const [tenantQuestionnaireLoading, setTenantQuestionnaireLoading] = useState(false)
  const [rentScoreBreakdownOpen, setRentScoreBreakdownOpen] = useState(false)
  const rentScoreCardRef = useRef<HTMLDivElement>(null)
  const [matchByPropertyId, setMatchByPropertyId] = useState<Record<string, MatchResult>>({})
  const [matchByTenantId, setMatchByTenantId] = useState<Record<string, MatchResult>>({})
  const [matchLoading, setMatchLoading] = useState(false)
  const [landlordCardBusyId, setLandlordCardBusyId] = useState<string | null>(null)
  const [landlordCardError, setLandlordCardError] = useState<{ cardId: string; message: string } | null>(null)

  const commitTenantMatchesTab = useCallback(
    (tab: 'all' | 'saved' | 'applied') => {
      setActiveTab(tab)
      if (profileRole !== 'tenant') return
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev)
          if (tab === 'all') next.delete('tab')
          else next.set('tab', tab)
          return next
        },
        { replace: true },
      )
    },
    [profileRole, setSearchParams],
  )

  useEffect(() => {
    if (profileRole !== 'tenant') return
    const t = searchParams.get('tab')
    if (t === 'saved' || t === 'applied') setActiveTab(t)
    else setActiveTab('all')
  }, [profileRole, searchParams])

  const loadTenantQuestionnaireScore = useCallback(async () => {
    if (!user || profileRole !== 'tenant') return
    setTenantQuestionnaireLoading(true)
    const { data } = await supabase
      .from('tenant_questionnaire')
      .select('overall_score, affordability_score, stability_score, payment_risk_score, lifestyle_score, space_fit_score')
      .eq('user_id', user.id)
      .maybeSingle()
    if (data) {
      const dimensions = dimensionsFromTenantQuestionnaireRow(data)
      setTenantDimensionScores(dimensions)
      // Same 0–100 figure as landlord tenant profile; ignores stale overall_score column.
      setTenantOverallScore(computeTenantRentScoreFromDimensions(dimensions))
    } else {
      setTenantOverallScore(null)
      setTenantDimensionScores(null)
    }
    setTenantQuestionnaireLoading(false)
  }, [user, profileRole])

  useEffect(() => {
    loadTenantQuestionnaireScore()
  }, [loadTenantQuestionnaireScore])

  // Refetch profile once when tenant lands on matches with survey incomplete (avoids stale state
  // after completing questionnaire so we don't flash the "Set your preferences" prompt)
  const [tenantSurveyRefetched, setTenantSurveyRefetched] = useState(false)
  useEffect(() => {
    if (profileRole !== 'tenant' || roleLoading || tenantSurveyCompletedAt != null || tenantSurveyRefetched) return
    refetchProfile().then(() => setTenantSurveyRefetched(true))
  }, [profileRole, roleLoading, tenantSurveyCompletedAt, tenantSurveyRefetched, refetchProfile])

  const loadTenantMatches = useCallback(async () => {
    const { data, error } = await supabase
      .from('properties')
      .select(
        'id, title, address_line1, city, state, bedrooms, bathrooms, amenities, monthly_rent_cents, landlord_id, photo_urls, photo_labels, landlord:landlord_id(display_name, avatar_url)',
      )
      .eq('status', 'active')
      .order('created_at', { ascending: false })

    if (error) {
      setError(error.message)
      return
    }

    type PropRow = {
      id: string
      title: string | null
      address_line1: string
      city: string
      state: string | null
      bedrooms: number
      bathrooms: number
      amenities: unknown
      monthly_rent_cents: number
      landlord_id: string
      photo_urls?: string[] | null
      photo_labels?: string[] | null
      landlord?: { display_name?: string | null; avatar_url?: string | null } | { display_name?: string | null; avatar_url?: string | null }[] | null
    }

    setTenantMatches(
      ((data ?? []) as PropRow[]).map((p) => {
        const amenityList = Array.isArray(p.amenities) ? p.amenities.map((a) => String(a)) : []
        // Display emojis on match cards; filtering still uses the raw amenity keys.
        const amenityDisplay = amenityList.map((a) => AMENITY_LABELS[a] ?? a)
        const landlordRaw = p.landlord
        const landlord = Array.isArray(landlordRaw) ? landlordRaw[0] : landlordRaw
        return {
          id: p.id,
          title: p.title || p.address_line1,
          location: [p.city, p.state].filter(Boolean).join(', '),
          price: `${formatCurrency(p.monthly_rent_cents)}/month`,
          saved: false,
          compatibility: 'Property matched based on your preferences.',
          tags: [formatBedrooms(p.bedrooms), ...amenityDisplay.slice(0, 3)].filter(Boolean),
          bedrooms: Number(p.bedrooms) || 0,
          monthly_rent_cents: Number(p.monthly_rent_cents) || 0,
          amenitiesList: amenityList,
          landlordId: p.landlord_id,
          landlordDisplayName: landlord?.display_name?.trim() || null,
          photoUrl: Array.isArray(p.photo_urls) && p.photo_urls.length > 0 ? String(p.photo_urls[0]) : null,
          photoAlt:
            Array.isArray(p.photo_labels) && p.photo_labels.length > 0
              ? String(p.photo_labels[0] || 'Property photo')
              : 'Property photo',
        }
      }),
    )
  }, [])

  const loadAppliedIds = useCallback(async () => {
    if (!user || profileRole !== 'tenant') return
    const { data, error } = await supabase
      .from('applications')
      .select('id, property_id, created_at')
      .eq('tenant_id', user.id)
      .order('created_at', { ascending: false })
    if (error) return

    const rows = (data ?? []) as Array<{ id: string; property_id: string; created_at: string }>
    setAppliedIds(new Set(rows.map((r) => r.property_id)))
    const idByProp: Record<string, string> = {}
    for (const r of rows) {
      if (!idByProp[r.property_id]) idByProp[r.property_id] = r.id
    }
    setApplicationIdByPropertyId(idByProp)

    // Universal rental application window controls whether the tenant can apply to properties.
    const nowIso = new Date().toISOString()
    const { data: universalData } = await supabase
      .from('universal_applications')
      .select('id')
      .eq('tenant_id', user.id)
      .eq('status', 'active')
      .gt('valid_until', nowIso)
      .limit(1)

    setHasActiveUniversalApplication((universalData ?? []).length > 0)
  }, [user, profileRole])

  const loadLandlordMatches = useCallback(async (propertyIds: string[]) => {
    if (!user || propertyIds.length === 0) {
      setLandlordMatches([])
      return
    }

    const selectColumns =
      'id, tenant_id, property_id, status, unlocked_at, created_at, tenant:tenant_id(id, display_name, avatar_url), property:property_id(id, title, address_line1)'

    const [result, propMetaResult, sessionResult] = await Promise.all([
      supabase
        .from('applications')
        .select(selectColumns)
        .in('property_id', propertyIds)
        .order('created_at', { ascending: false }),
      supabase.from('properties').select('id, title, address_line1').in('id', propertyIds).eq('landlord_id', user.id),
      supabase.auth.getSession(),
    ])

    if (result.error) {
      setError(result.error.message)
      return
    }

    type AppRow = {
      id: string
      tenant_id: string
      property_id: string
      status: string
      unlocked_at?: string | null
      created_at: string
      tenant?: { id?: string; display_name?: string; avatar_url?: string | null }
      property?: { id?: string; title?: string; address_line1?: string }
    }
    const rows = (result.data ?? []) as AppRow[]

    const propLabelById = new Map<string, string>()
    for (const p of (propMetaResult.data ?? []) as Array<{ id: string; title?: string | null; address_line1?: string }>) {
      propLabelById.set(p.id, p.title?.trim() || p.address_line1 || 'Listing')
    }

    const token = sessionResult.data.session?.access_token ?? null
    let catalogRows: Awaited<ReturnType<typeof fetchLandlordMatchCatalog>>['rows'] = []
    if (token) {
      try {
        const data = await fetchLandlordMatchCatalog(token, user.id, propertyIds, { limitPerProperty: 50 })
        catalogRows = data.rows ?? []
      } catch {
        catalogRows = []
      }
    }

    function appRowTenantPropertyKey(row: AppRow): string {
      const tid = row.tenant_id || row.tenant?.id || row.id
      return `${row.property_id}:${tid}`
    }

    /** One card per listing+tenant: prefer unlocked pending over newer locked duplicate applies. */
    function pickPrimaryApplicationRow(group: AppRow[]): AppRow | undefined {
      if (group.length === 0) return undefined
      const pending = group.filter((r) => r.status === 'pending')
      if (pending.length > 0) {
        const unlocked = pending.filter(
          (r) => r.unlocked_at != null && String(r.unlocked_at).trim() !== '',
        )
        const pool = unlocked.length > 0 ? unlocked : pending
        return pool.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      }
      return group.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
    }

    const appGroupsByKey = new Map<string, AppRow[]>()
    for (const row of rows) {
      const k = appRowTenantPropertyKey(row)
      if (!appGroupsByKey.has(k)) appGroupsByKey.set(k, [])
      appGroupsByKey.get(k)!.push(row)
    }

    const appByKey = new Map<string, AppRow>()
    for (const [k, group] of appGroupsByKey) {
      const picked = pickPrimaryApplicationRow(group)
      if (picked) appByKey.set(k, picked)
    }

    function catalogMatchToPreview(m: MatchResult & { tenantScore?: number | null }): MatchResult {
      return {
        eligible: m.eligible,
        reasons: m.reasons,
        overall: m.overall,
        dimensions: m.dimensions,
        tenantScore: m.tenantScore,
      }
    }

    const mergedByKey = new Map<string, LandlordMatchCard>()

    for (const cr of catalogRows) {
      const key = `${cr.propertyId}:${cr.tenantId}`
      const app = appByKey.get(key)
      const listingLabel = propLabelById.get(cr.propertyId) ?? 'Listing'
      const tid = cr.tenantId
      mergedByKey.set(key, {
        id: app?.id ?? `prospect:${cr.propertyId}:${cr.tenantId}`,
        applicationId: app?.id ?? null,
        hasApplication: !!app,
        applicationCreatedAt: app?.created_at ?? null,
        tenantId: tid,
        propertyId: cr.propertyId,
        listingLabel,
        name: app?.tenant?.display_name?.trim() || cr.name || 'Tenant',
        avatarUrl: app?.tenant?.avatar_url ?? cr.avatarUrl ?? null,
        appliedAgo: app ? formatRelativeTime(app.created_at) : 'No application yet',
        status: app ? applicationStatusToMatch(app.status, app.unlocked_at ?? null) : 'locked',
        matchPreview: catalogMatchToPreview(cr.match),
        applicationUnlockedAt: app?.unlocked_at ?? null,
        compatibilitySummary: '',
        creditScore: '—',
        tenantScore: '—',
        leaseIntent: '—',
      })
    }

    for (const [key, group] of appGroupsByKey) {
      if (mergedByKey.has(key)) continue
      const row = pickPrimaryApplicationRow(group)
      if (!row) continue
      const tid = row.tenant_id || row.tenant?.id || row.id
      const listingLabel =
        row.property?.title?.trim() || row.property?.address_line1 || propLabelById.get(row.property_id) || 'Listing'
      mergedByKey.set(key, {
        id: row.id,
        applicationId: row.id,
        hasApplication: true,
        applicationCreatedAt: row.created_at,
        tenantId: tid,
        propertyId: row.property_id,
        listingLabel,
        name: row.tenant?.display_name || 'Tenant',
        avatarUrl: row.tenant?.avatar_url ?? null,
        appliedAgo: formatRelativeTime(row.created_at),
        status: applicationStatusToMatch(row.status, row.unlocked_at ?? null),
        matchPreview: null,
        applicationUnlockedAt: row.unlocked_at ?? null,
        compatibilitySummary: '',
        creditScore: '—',
        tenantScore: '—',
        leaseIntent: '—',
      })
    }

    const tenantIds = [...new Set([...mergedByKey.values()].map((m) => m.tenantId))] as string[]
    const leaseByTenantId = new Map<string, number | null>()
    if (tenantIds.length > 0) {
      const prefsResult = await supabase
        .from('tenant_preferences')
        .select('user_id, lease_length_months')
        .in('user_id', tenantIds)
      if (!prefsResult.error) {
        for (const p of (prefsResult.data ?? []) as Array<{ user_id: string; lease_length_months: number | null }>) {
          leaseByTenantId.set(p.user_id, p.lease_length_months ?? null)
        }
      }
    }

    const mergedList = [...mergedByKey.values()].map((m) => ({
      ...m,
      leaseIntent: formatLeaseIntentLabel(leaseByTenantId.get(m.tenantId)),
    }))

    mergedList.sort((a, b) => {
      if (a.hasApplication !== b.hasApplication) return a.hasApplication ? -1 : 1
      if (a.hasApplication && b.hasApplication) {
        const ta = a.applicationCreatedAt ? new Date(a.applicationCreatedAt).getTime() : 0
        const tb = b.applicationCreatedAt ? new Date(b.applicationCreatedAt).getTime() : 0
        return tb - ta
      }
      const oa = a.matchPreview?.overall ?? 0
      const ob = b.matchPreview?.overall ?? 0
      return ob - oa
    })

    setLandlordMatches(mergedList)
  }, [user])

  const loadLandlordProperties = useCallback(async () => {
    if (!user) return

    const { data } = await supabase
      .from('properties')
      .select('id, title, address_line1')
      .eq('landlord_id', user.id)
      .order('created_at', { ascending: false })

    const list = (data ?? []).map((p) => ({
      id: p.id,
      label: p.title || p.address_line1,
    }))
    setLandlordProperties(list)
    return list
  }, [user])

  const reloadLandlordMatchesData = useCallback(async () => {
    const props = await loadLandlordProperties()
    const ids = props?.map((p) => p.id) ?? []
    const targetIds =
      landlordProperty && ids.includes(landlordProperty) ? [landlordProperty] : ids
    if (targetIds.length > 0) await loadLandlordMatches(targetIds)
    else {
      setLandlordMatches([])
    }
  }, [landlordProperty, loadLandlordMatches, loadLandlordProperties])

  const handleLandlordCardUnlock = useCallback(
    async (match: LandlordMatchCard) => {
      if (!user || !match.applicationId) return
      setLandlordCardError(null)
      setLandlordCardBusyId(match.id)
      try {
        const now = new Date().toISOString()
        const { data, error } = await supabase
          .from('applications')
          .update({ unlocked_at: now })
          .eq('id', match.applicationId)
          .eq('status', 'pending')
          .select('id')
        if (error) throw error
        if (!data?.length) {
          throw new Error('This application could not be unlocked. It may no longer be pending.')
        }
        await reloadLandlordMatchesData()
      } catch (e) {
        setLandlordCardError({
          cardId: match.id,
          message: e instanceof Error ? e.message : 'Could not unlock',
        })
      } finally {
        setLandlordCardBusyId(null)
      }
    },
    [user, reloadLandlordMatchesData],
  )

  const handleLandlordCardUndoDecline = useCallback(
    async (match: LandlordMatchCard) => {
      if (!user || !match.applicationId) return
      setLandlordCardError(null)
      setLandlordCardBusyId(match.id)
      try {
        const { data: prior, error: priorErr } = await supabase
          .from('applications')
          .select('unlocked_at')
          .eq('id', match.applicationId)
          .eq('status', 'rejected')
          .maybeSingle()
        if (priorErr) throw priorErr
        const unlockToKeep =
          prior?.unlocked_at ??
          (match.applicationUnlockedAt?.trim() ? match.applicationUnlockedAt : null)
        const { error } = await supabase
          .from('applications')
          .update({
            status: 'pending',
            ...(unlockToKeep ? { unlocked_at: unlockToKeep } : {}),
          })
          .eq('id', match.applicationId)
          .eq('status', 'rejected')
        if (error) throw error
        await reloadLandlordMatchesData()
      } catch (e) {
        setLandlordCardError({
          cardId: match.id,
          message: e instanceof Error ? e.message : 'Could not restore application',
        })
      } finally {
        setLandlordCardBusyId(null)
      }
    },
    [user, reloadLandlordMatchesData],
  )

  const handleLandlordCardApprove = useCallback(
    async (match: LandlordMatchCard) => {
      if (!user || !match.applicationId) return
      setLandlordCardError(null)
      setLandlordCardBusyId(match.id)
      try {
        const { data: updated, error: updateErr } = await supabase
          .from('applications')
          .update({ status: 'approved' })
          .eq('id', match.applicationId)
          .eq('status', 'pending')
          .not('unlocked_at', 'is', null)
          .select('id')
        if (updateErr) throw updateErr
        if (!updated?.length) {
          throw new Error('This application could not be approved. It may no longer be pending.')
        }

        const { data: existing } = await supabase
          .from('message_threads')
          .select('id')
          .eq('tenant_id', match.tenantId)
          .eq('landlord_id', user.id)
          .maybeSingle()

        if (existing) {
          const { error: touchErr } = await supabase
            .from('message_threads')
            .update({
              property_id: match.propertyId,
              application_id: match.applicationId,
            })
            .eq('id', existing.id)
          if (touchErr) throw touchErr
        } else {
          const { error: insertErr } = await supabase.from('message_threads').insert({
            application_id: match.applicationId,
            tenant_id: match.tenantId,
            landlord_id: user.id,
            property_id: match.propertyId,
          })
          if (insertErr) throw insertErr
        }

        await reloadLandlordMatchesData()
      } catch (e) {
        setLandlordCardError({
          cardId: match.id,
          message: e instanceof Error ? e.message : 'Could not approve',
        })
      } finally {
        setLandlordCardBusyId(null)
      }
    },
    [user, reloadLandlordMatchesData],
  )

  const handleLandlordCardDecline = useCallback(
    async (match: LandlordMatchCard) => {
      if (!user || !match.applicationId) return
      setLandlordCardError(null)
      setLandlordCardBusyId(match.id)
      try {
        const { data: updated, error } = await supabase
          .from('applications')
          .update({ status: 'rejected' })
          .eq('id', match.applicationId)
          .eq('status', 'pending')
          .not('unlocked_at', 'is', null)
          .select('id')
        if (error) throw error
        if (!updated?.length) {
          throw new Error('This application could not be declined. It may no longer be pending.')
        }
        await reloadLandlordMatchesData()
      } catch (e) {
        setLandlordCardError({
          cardId: match.id,
          message: e instanceof Error ? e.message : 'Could not decline',
        })
      } finally {
        setLandlordCardBusyId(null)
      }
    },
    [user, reloadLandlordMatchesData],
  )

  // Load match scores for landlord applicant list
  useEffect(() => {
    if (profileRole !== 'landlord' || !user || landlordMatches.length === 0) return
    let cancelled = false
    setMatchLoading(true)
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token || cancelled) return
      try {
        const tenantIds = landlordMatches.map((m) => m.tenantId).filter(Boolean)
        if (tenantIds.length === 0) { if (!cancelled) setMatchLoading(false); return }
        const matches = await fetchMatchesForLandlord(token, user.id, tenantIds)
        if (!cancelled) setMatchByTenantId(matches)
      } catch {
        if (!cancelled) setMatchByTenantId({})
      } finally {
        if (!cancelled) setMatchLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user, profileRole, landlordMatches])

  useEffect(() => {
    if (!user) {
      setLoading(false)
      return
    }
    if (roleLoading || profileRole === null) {
      return
    }

    setLoading(true)
    setError(null)

    if (profileRole === 'tenant') {
      Promise.all([loadTenantMatches(), loadAppliedIds()]).finally(() => setLoading(false))
    } else {
      loadLandlordProperties().then((props) => {
        const ids = props?.map((p) => p.id) ?? []
        const targetIds =
          landlordProperty && ids.includes(landlordProperty) ? [landlordProperty] : ids
        if (targetIds.length > 0) {
          loadLandlordMatches(targetIds).finally(() => setLoading(false))
        } else {
          setLandlordMatches([])
          setLoading(false)
        }
      }).catch(() => {
        setLandlordMatches([])
        setLoading(false)
      })
    }
  }, [
    user,
    roleLoading,
    profileRole,
    landlordProperty,
    loadTenantMatches,
    loadAppliedIds,
    loadLandlordMatches,
    loadLandlordProperties,
  ])

  const toggleAmenity = (key: keyof typeof amenities) =>
    setAmenities((prev) => ({ ...prev, [key]: !prev[key] }))

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveSavedIds(next)
      return next
    })
  }

  const handleApplyNow = async (match: MatchCard) => {
    if (!user) return

    // If the tenant does not have an active universal application, send them to the application page
    if (hasActiveUniversalApplication === false) {
      navigate('/applications/apply')
      return
    }

    const { error } = await supabase.from('applications').insert({
      tenant_id: user.id,
      property_id: match.id,
      status: 'pending',
    })
    if (error && error.code !== '23505') {
      setError(error.message)
      return
    }
    setAppliedIds((prev) => new Set(prev).add(match.id))
    setSubmissionModal({ propertyTitle: match.title })
  }

  const displayedMatches =
    activeTab === 'saved'
      ? tenantMatches.filter((m) => savedIds.has(m.id))
      : activeTab === 'applied'
        ? tenantMatches.filter((m) => appliedIds.has(m.id))
        : tenantMatches

  const filteredMatches = useMemo(() => {
    let list = displayedMatches
    if (bedrooms !== 'any') {
      const minBeds = bedrooms === '4+' ? 4 : parseInt(bedrooms, 10)
      list = list.filter((m) => m.bedrooms >= minBeds)
    }
    list = list.filter(
      (m) =>
        m.monthly_rent_cents >= priceRange[0] * 100 &&
        m.monthly_rent_cents <= priceRange[1] * 100,
    )
    if (amenities.petFriendly) list = list.filter((m) => m.amenitiesList.includes('pet_friendly'))
    if (amenities.parking) list = list.filter((m) => m.amenitiesList.includes('parking'))
    if (amenities.laundry) list = list.filter((m) => m.amenitiesList.includes('laundry'))
    if (amenities.gym) list = list.filter((m) => m.amenitiesList.includes('gym'))
    return list
  }, [displayedMatches, bedrooms, priceRange, amenities])

  // Tenant: only show properties that are actual matches (eligible), sorted by score, top N only
  const matchesToShow = useMemo(() => {
    if (profileRole !== 'tenant' || tenantOverallScore == null) return []
    if (activeTab === 'applied') {
      return [...filteredMatches].sort(
        (a, b) => (matchByPropertyId[b.id]?.overall ?? 0) - (matchByPropertyId[a.id]?.overall ?? 0),
      )
    }
    const withScores = filteredMatches.filter((m) => matchByPropertyId[m.id]?.eligible === true)
    const sorted = [...withScores].sort(
      (a, b) => (matchByPropertyId[b.id]?.overall ?? 0) - (matchByPropertyId[a.id]?.overall ?? 0),
    )
    return sorted.slice(0, MAX_TENANT_TOP_MATCHES)
  }, [profileRole, tenantOverallScore, activeTab, filteredMatches, matchByPropertyId])

  const tenantMatchScoreIdsKey = useMemo(
    () => filteredMatches.map((m) => m.id).slice().sort().join('|'),
    [filteredMatches],
  )

  useEffect(() => {
    if (profileRole !== 'tenant' || !user || tenantOverallScore == null) return
    if (filteredMatches.length === 0) {
      setMatchByPropertyId({})
      setMatchLoading(false)
      return
    }
    let cancelled = false
    setMatchLoading(true)
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token || cancelled) {
        if (!cancelled) setMatchLoading(false)
        return
      }
      const ids = filteredMatches.map((m) => m.id)
      try {
        const matches = await fetchMatchesForTenant(token, user.id, ids, { limit: MAX_TENANT_TOP_MATCHES })
        if (!cancelled) setMatchByPropertyId(matches)
      } catch {
        if (!cancelled) setMatchByPropertyId({})
      } finally {
        if (!cancelled) setMatchLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [user, profileRole, tenantOverallScore, tenantMatchScoreIdsKey])

  const hasMatches = profileRole === 'tenant' && tenantOverallScore != null ? matchesToShow.length > 0 : filteredMatches.length > 0
  const statusFilteredLandlordMatches = landlordMatches.filter((match) => {
    if (landlordFilter === 'all') return true
    if (landlordFilter === 'applications') return match.hasApplication
    if (landlordFilter === 'prospects') return !match.hasApplication
    return match.hasApplication && effectiveLandlordWorkflowStatus(match) === landlordFilter
  })
  const tenantScopedLandlordMatches = landlordMatchesTenantId
    ? statusFilteredLandlordMatches.filter((m) => m.tenantId === landlordMatchesTenantId)
    : statusFilteredLandlordMatches
  const displayedLandlordMatches = tenantScopedLandlordMatches

  const landlordTenantDropdownOptions = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of statusFilteredLandlordMatches) {
      if (!map.has(m.tenantId)) map.set(m.tenantId, m.name)
    }
    if (landlordMatchesTenantId && !map.has(landlordMatchesTenantId)) {
      const name =
        landlordMatches.find((m) => m.tenantId === landlordMatchesTenantId)?.name ?? 'Tenant'
      map.set(landlordMatchesTenantId, name)
    }
    return [...map.entries()].sort((a, b) =>
      a[1].localeCompare(b[1], undefined, { sensitivity: 'base' }),
    )
  }, [statusFilteredLandlordMatches, landlordMatchesTenantId, landlordMatches])
  const landlordTotalPages = Math.max(1, Math.ceil(displayedLandlordMatches.length / MATCHES_PAGE_SIZE))
  const landlordPageStart = (landlordPage - 1) * MATCHES_PAGE_SIZE
  const paginatedLandlordMatches = displayedLandlordMatches.slice(
    landlordPageStart,
    landlordPageStart + MATCHES_PAGE_SIZE,
  )
  const tenantBaseMatches =
    profileRole === 'tenant' && tenantOverallScore != null ? matchesToShow : filteredMatches
  const tenantTotalPages = Math.max(1, Math.ceil(tenantBaseMatches.length / TENANT_MATCHES_PAGE_SIZE))
  const tenantPageStart = (tenantPage - 1) * TENANT_MATCHES_PAGE_SIZE
  const paginatedTenantMatches = tenantBaseMatches.slice(
    tenantPageStart,
    tenantPageStart + TENANT_MATCHES_PAGE_SIZE,
  )

  useEffect(() => {
    setLandlordPage(1)
  }, [landlordFilter, landlordProperty, landlordMatchesTenantId])

  useEffect(() => {
    if (landlordPage > landlordTotalPages) setLandlordPage(landlordTotalPages)
  }, [landlordPage, landlordTotalPages])

  useEffect(() => {
    setTenantPage(1)
  }, [activeTab, bedrooms, priceRange, amenities])

  useEffect(() => {
    if (tenantPage > tenantTotalPages) setTenantPage(tenantTotalPages)
  }, [tenantPage, tenantTotalPages])

  if (roleLoading || profileRole === null) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-8">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  if (profileRole === 'landlord') {
    return (
      <>
        <div className="flex min-h-full flex-col px-4 py-4">
          {!landlordSurveyCompletedAt ? (
            <div className="mx-auto mb-6 max-w-2xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-semibold text-gray-900">Ready to find matches?</h2>
              <p className="mt-1 text-sm text-gray-600">You&apos;ll need to finish the next few items to receive matches.</p>
              <ul className="mt-5 space-y-3">
                <li>
                  {displayName ? (
                    <div className="flex cursor-default items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">Create Profile</p>
                        <p className="text-xs text-gray-500">Sub-line for company details</p>
                      </div>
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    </div>
                  ) : (
                    <Link to="/onboarding/profile" className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-4 transition-colors hover:bg-gray-50">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">Create Profile</p>
                        <p className="text-xs text-gray-500">Sub-line for company details</p>
                      </div>
                      <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </Link>
                  )}
                </li>
                <li>
                  <Link to="/onboarding/survey/intro" className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-4 transition-colors hover:bg-gray-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">Finish Landlord Survey</p>
                      <p className="text-xs text-gray-500">Complete your profile for better tenant matching.</p>
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
                <li>
                  <Link to="/onboarding/property/intro" className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-4 transition-colors hover:bg-gray-50">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-900 text-white">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">Add My First Property</p>
                      <p className="text-xs text-gray-500">Start listing your property to find tenants.</p>
                    </div>
                    <svg className="h-5 w-5 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                </li>
              </ul>
            </div>
          ) : null}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-24">
                    Property
                  </span>
                  <div className="relative min-w-[min(100%,16rem)] max-w-md flex-1 sm:min-w-[14rem]">
                    <select
                      value={landlordProperty}
                      onChange={(event) => setLandlordProperty(event.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                    >
                      <option value="">All properties</option>
                      {landlordProperties.map((p) => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                <p className="shrink-0 text-sm text-gray-500 sm:text-right">
                  {loading ? 'Loading...' : `${displayedLandlordMatches.length} matches`}
                </p>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-24 sm:pt-0">
                    Matches
                  </span>
                  <div className="relative min-w-[min(100%,16rem)] max-w-md flex-1 sm:min-w-[14rem]">
                    <select
                      value={landlordFilter}
                      onChange={(event) =>
                        setLandlordFilter(event.target.value as LandlordMatchFilter)
                      }
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                    >
                      <option value="all">All matches</option>
                      <option value="applications">Applications</option>
                      <option value="prospects">Prospects</option>
                      <option value="locked">Locked</option>
                      <option value="unlocked">Unlocked</option>
                      <option value="accepted">Accepted</option>
                      <option value="declined">Declined</option>
                    </select>
                    <svg
                      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                  <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:w-24 sm:pt-0">
                    Tenant
                  </span>
                  <div className="relative min-w-[min(100%,16rem)] max-w-md flex-1 sm:min-w-[14rem]">
                    <select
                      value={landlordMatchesTenantId ?? ''}
                      onChange={(event) => {
                        const v = event.target.value
                        setSearchParams(
                          (prev) => {
                            const next = new URLSearchParams(prev)
                            if (!v) next.delete('tenant')
                            else next.set('tenant', v)
                            return next
                          },
                          { replace: true },
                        )
                      }}
                      className="w-full appearance-none rounded-lg border border-gray-200 bg-white px-4 py-2.5 pr-10 text-sm text-gray-700 focus:border-gray-300 focus:outline-none"
                    >
                      <option value="">All tenants</option>
                      {landlordTenantDropdownOptions.map(([tid, label]) => (
                        <option key={tid} value={tid}>{label}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="mt-8 flex justify-center py-12">
              <p className="text-sm text-gray-500">Loading matches...</p>
            </div>
          ) : (
          <>
          <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {paginatedLandlordMatches.map((match) => {
              const workflow = effectiveLandlordWorkflowStatus(match)
              return (
              <div
                key={match.id}
                className="flex h-full flex-col rounded-xl border border-gray-200 bg-white p-4"
              >
                <>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <Link
                        to={landlordTenantProfilePath(match)}
                        state={tenantProfileNavState}
                        className="shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                        aria-label={`${match.name} profile`}
                      >
                        <LandlordAvatar name={match.name} avatarUrl={match.avatarUrl} />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={landlordTenantProfilePath(match)}
                          state={tenantProfileNavState}
                          className="block text-[1.15rem] font-medium text-gray-900 hover:underline decoration-gray-400 underline-offset-2"
                        >
                          {match.name}
                        </Link>
                        <Link
                          to={`/properties/${encodeURIComponent(match.propertyId)}`}
                          state={{ from: `${location.pathname}${location.search}` }}
                          className="mt-0.5 block text-sm font-medium text-gray-700 hover:text-gray-900 hover:underline decoration-gray-400 underline-offset-2"
                        >
                          {match.listingLabel}
                        </Link>
                        <p className="mt-0.5 text-sm text-gray-500">{match.appliedAgo}</p>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                        !match.hasApplication
                          ? 'bg-gray-100 text-gray-600'
                          : workflow === 'declined'
                            ? 'bg-red-50 text-red-700'
                            : workflow === 'accepted'
                              ? 'bg-emerald-50 text-emerald-800'
                              : workflow === 'unlocked'
                                ? 'bg-sky-50 text-sky-800'
                                : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {match.hasApplication ? LANDLORD_MATCH_STATUS_LABEL[workflow] : 'No application'}
                    </span>
                  </div>

                  <Link
                    to={landlordTenantProfilePath(match)}
                    state={tenantProfileNavState}
                    className="group mt-5 flex min-h-0 flex-1 flex-col rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-gray-400 focus-visible:ring-offset-2"
                  >
                  <div className="flex min-h-0 flex-1 flex-col">
                    <div className="space-y-3 text-sm">
                      {(() => {
                        const matchData = match.matchPreview ?? matchByTenantId[match.tenantId]
                        if (matchLoading && !matchData) {
                          return <div className="text-gray-500">Loading match data…</div>
                        }
                        if (matchData) {
                          return (
                            <>
                              {matchData.eligible && matchData.dimensions ? (
                                <MatchScoreDisplay
                                  overall={matchData.overall}
                                  dimensions={matchData.dimensions}
                                  compact
                                  showQuestionnaireIncomeHint={false}
                                />
                              ) : (
                                <div className="flex items-start justify-between gap-6">
                                  <span className="text-gray-500">Match score</span>
                                  <span className="text-amber-700 text-xs">Not eligible</span>
                                </div>
                              )}
                              <div className="flex items-start justify-between gap-6">
                                <span className="text-gray-500">Tenant score</span>
                                <span className="text-right text-gray-900">
                                  {matchData.tenantScore != null ? String(matchData.tenantScore) : '—'}
                                </span>
                              </div>
                              <div className="flex items-start justify-between gap-6">
                                <span className="text-gray-500">Credit score</span>
                                <span className="text-right text-gray-900">{match.creditScore}</span>
                              </div>
                              <div className="flex items-start justify-between gap-6">
                                <span className="text-gray-500">Lease intent</span>
                                <span className="text-right text-gray-900">{match.leaseIntent}</span>
                              </div>
                            </>
                          )
                        }
                        return (
                          <>
                            <div className="flex items-start justify-between gap-6">
                              <span className="text-gray-500">Compatibility Summary</span>
                              <span className="text-right text-gray-900">{match.compatibilitySummary}</span>
                            </div>
                            <div className="flex items-start justify-between gap-6">
                              <span className="text-gray-500">Credit Score</span>
                              <span className="text-right text-gray-900">{match.creditScore}</span>
                            </div>
                            <div className="flex items-start justify-between gap-6">
                              <span className="text-gray-500">Tenant Score</span>
                              <span className="text-right text-gray-900">{match.tenantScore}</span>
                            </div>
                            <div className="flex items-start justify-between gap-6">
                              <span className="text-gray-500">Lease Intent</span>
                              <span className="text-right text-gray-900">{match.leaseIntent}</span>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  </Link>
                </>

                {match.hasApplication &&
                (workflow === 'locked' || workflow === 'declined' || workflow === 'unlocked') ? (
                  <div className="mt-4 border-t border-gray-100 pt-4">
                    {landlordCardError?.cardId === match.id ? (
                      <p className="mb-3 text-sm text-red-600">{landlordCardError.message}</p>
                    ) : null}
                    <div className="flex w-full flex-col gap-2">
                      {workflow === 'locked' ? (
                        <button
                          type="button"
                          onClick={() => handleLandlordCardUnlock(match)}
                          disabled={landlordCardBusyId !== null}
                          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {landlordCardBusyId === match.id ? 'Unlocking…' : 'Unlock profile'}
                        </button>
                      ) : null}
                      {workflow === 'unlocked' ? (
                        <div className="grid w-full grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => handleLandlordCardApprove(match)}
                            disabled={landlordCardBusyId !== null}
                            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {landlordCardBusyId === match.id ? (
                              'Approving…'
                            ) : (
                              <>
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                                Approve
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleLandlordCardDecline(match)}
                            disabled={landlordCardBusyId !== null}
                            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {landlordCardBusyId === match.id ? (
                              'Declining…'
                            ) : (
                              <>
                                <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                                Decline
                              </>
                            )}
                          </button>
                        </div>
                      ) : null}
                      {workflow === 'declined' ? (
                        <button
                          type="button"
                          onClick={() => handleLandlordCardUndoDecline(match)}
                          disabled={landlordCardBusyId !== null}
                          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {landlordCardBusyId === match.id ? 'Restoring…' : 'Undo decline'}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>
              )
            })}
          </div>

          {displayedLandlordMatches.length > MATCHES_PAGE_SIZE ? (
            <div className="mt-8 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setLandlordPage((p) => Math.max(1, p - 1))}
                disabled={landlordPage === 1}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {landlordPage} of {landlordTotalPages}
              </span>
              <button
                type="button"
                onClick={() => setLandlordPage((p) => Math.min(landlordTotalPages, p + 1))}
                disabled={landlordPage === landlordTotalPages}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          ) : null}

          </>
          )}

        </div>

      </>
    )
  }

  // Tenant: lease prefs done but questionnaire not done → show CTA to complete questionnaire to see matches
  if (
    tenantSurveyCompletedAt &&
    profileRole === 'tenant' &&
    tenantOverallScore == null &&
    !roleLoading &&
    !tenantQuestionnaireLoading
  ) {
    return (
      <div className="space-y-6">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm text-center">
          <h2 className="text-xl font-semibold text-gray-900">See your matches</h2>
          <p className="mt-2 text-sm text-gray-600">
            Complete the short questionnaire so we can show you properties that match your profile and preferences.
          </p>
          <Link
            to="/tenant-questionnaire"
            className="mt-6 inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-3 text-sm font-medium text-white"
          >
            Complete questionnaire
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {!tenantSurveyCompletedAt ? (
        !tenantSurveyRefetched ? (
          <div className="flex min-h-[40vh] items-center justify-center px-4 py-8">
            <p className="text-sm text-gray-500">Loading...</p>
          </div>
        ) : (
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-gray-900 text-white">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Under 2 min
            </span>
            <h2 className="mt-4 text-2xl font-semibold text-gray-900">Set your lease preferences</h2>
            <p className="mt-3 max-w-[480px] text-sm leading-7 text-gray-600">
              Share your move date, budget, and preferences so we can match you with the right properties.
            </p>
          </div>

          <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50/50 p-5">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <svg className="h-4 w-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                What we&apos;ll ask
              </p>
              <ul className="mt-3 space-y-2 text-sm text-gray-600">
                {['Lease length and move date', 'Preferred budget range', 'Pets and living situation'].map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <svg className="h-4 w-4 shrink-0 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 text-center">
            <Link
              to="/lease-preferences"
              state={{ from: 'matches' }}
              className="inline-flex items-center gap-2 rounded-lg btn-primary px-6 py-3 text-sm font-medium text-white"
            >
              Set your preferences
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <p className="mt-3 text-xs text-gray-500">
              Required to view property matches. You can update your preferences anytime from your profile.
            </p>
          </div>
        </div>
        )
      ) : null}
      {tenantSurveyCompletedAt ? (
      <>
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Your Matches</h1>
          <p className="text-gray-600 mt-1">
            {activeTab === 'applied'
              ? 'Properties you’ve applied to. Adjust filters above to narrow the list.'
              : 'Properties matched based on your preferences and compatibility.'}
          </p>
        </div>
        {profileRole === 'tenant' && (
          <div ref={rentScoreCardRef} className="relative flex-shrink-0 bg-white rounded-xl border border-gray-200 p-4 min-w-[140px]">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-sm font-medium text-gray-700">Rent Score</span>
              {tenantOverallScore != null ? (
                <button
                  type="button"
                  onClick={() => setRentScoreBreakdownOpen((v) => !v)}
                  className="rounded-full p-0.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  aria-label="Show score breakdown"
                  title="See breakdown"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>
              ) : (
                <Link
                  to="/tenant-questionnaire"
                  className="text-gray-400 hover:text-gray-600"
                  aria-label="Complete questionnaire for personalized score"
                  title="Complete the questionnaire for a personalized score"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </Link>
              )}
            </div>
            <div className="flex justify-center">
              {tenantOverallScore != null ? (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border-[4px] border-emerald-500 text-2xl font-semibold text-gray-800">
                  {tenantOverallScore}
                </div>
              ) : (
                <Link
                  to="/tenant-questionnaire"
                  className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-sm font-medium text-gray-500 hover:border-gray-400 hover:text-gray-600"
                >
                  —
                </Link>
              )}
            </div>
            <TenantRentScoreBreakdownDialog
              open={rentScoreBreakdownOpen && tenantOverallScore != null}
              onClose={() => setRentScoreBreakdownOpen(false)}
              overallScore={tenantOverallScore ?? 0}
              dimensions={tenantDimensionScores}
              variant="tenant"
            />
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-1 border-b border-gray-200">
        <button
          type="button"
          onClick={() => commitTenantMatchesTab('all')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'all'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          All Matches
        </button>
        <button
          type="button"
          onClick={() => commitTenantMatchesTab('applied')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'applied'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Applied
        </button>
        <button
          type="button"
          onClick={() => commitTenantMatchesTab('saved')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'saved'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          Saved Properties
        </button>
      </div>

      <div className="flex flex-wrap gap-4 items-center rounded-lg border border-gray-200 bg-white p-4">
        <div>
          <label htmlFor="bedrooms" className="block text-xs font-medium text-gray-500 mb-1">
            Bedrooms
          </label>
          <select
            id="bedrooms"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
          >
            <option value="any">Any</option>
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
            <option value="4">4+</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">
            Price Range
          </label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-700">${priceRange[0]}</span>
            <input
              type="range"
              min={500}
              max={5000}
              step={100}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], Number(e.target.value)])}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />
            <span className="text-sm text-gray-700">${priceRange[1]}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-4">
          <span className="text-xs font-medium text-gray-500 self-end mb-1">Amenities</span>
          {[
            { key: 'petFriendly' as const, label: '🐾 Pet-friendly' },
            { key: 'parking' as const, label: '🅿️ Parking' },
            { key: 'laundry' as const, label: '🧺 Laundry' },
            { key: 'gym' as const, label: '🏋️ Gym' },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={amenities[key]}
                onChange={() => toggleAmenity(key)}
                className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              <span className="text-sm text-gray-700">{label}</span>
            </label>
          ))}
        </div>
      </div>

      {hasMatches ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {paginatedTenantMatches.map((match) => {
            const isSaved = savedIds.has(match.id)
            const isApplied = appliedIds.has(match.id)
            return (
              <div
                key={match.id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      to={`/property/${match.id}?from=matches`}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {match.title}
                    </Link>
                    <p className="mt-1 text-[2rem] font-medium leading-none text-gray-900">{match.price}</p>
                    <p className="mt-2 text-sm text-gray-600">
                      Listed by{' '}
                      <Link
                        to={tenantLandlordProfilePath(match.landlordId, {
                          propertyId: match.id,
                          returnTo: `${location.pathname}${location.search}`,
                        })}
                        className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:text-gray-950"
                      >
                        {match.landlordDisplayName?.trim() || 'View landlord profile'}
                      </Link>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSaved(match.id)}
                    className="rounded-full p-1.5 text-gray-400 hover:bg-gray-50 hover:text-gray-700"
                    aria-label={isSaved ? 'Unsave' : 'Save'}
                  >
                    {isSaved ? (
                      <svg className="h-5 w-5 text-gray-900" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21s-6.716-4.535-9.193-8.12C.99 10.257 1.37 6.84 4.127 4.963c2.168-1.476 5.02-1.05 6.873 1.027 1.853-2.076 4.705-2.503 6.873-1.027 2.757 1.877 3.137 5.294 1.32 7.917C18.716 16.465 12 21 12 21z" />
                      </svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    )}
                  </button>
                </div>

                <MatchCardPhoto url={match.photoUrl} alt={match.photoAlt} />

                <div className="flex-1 flex flex-col">
                  {(() => {
                    const matchData = matchByPropertyId[match.id]
                    if (matchLoading && !matchData) {
                      return (
                        <p className="mb-4 text-sm text-gray-500">Loading match score…</p>
                      )
                    }
                    if (matchData) {
                      const isQuestionnaireMissing = matchData.reasons?.some((r) =>
                            r.toLowerCase().includes('tenant questionnaire not completed')
                          ) ?? false
                      if (isQuestionnaireMissing) {
                        return (
                          <div className="mb-4">
                            <p className="text-sm text-gray-600">
                              Complete the short questionnaire to see your match score with this property.
                            </p>
                            <Link
                              to="/tenant-questionnaire"
                              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                            >
                              Complete questionnaire
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </Link>
                          </div>
                        )
                      }
                      return (
                        <div className="mb-3">
                          {matchData.eligible && matchData.dimensions ? (
                            <MatchScoreDisplay
                              overall={matchData.overall}
                              dimensions={matchData.dimensions}
                            />
                          ) : (
                            <span className="text-sm text-amber-700">
                              Not eligible — {matchData.reasons.join(' ')}
                            </span>
                          )}
                        </div>
                      )
                    }
                    return (
                      <p className="mb-4 text-sm text-gray-700">
                        <span className="font-semibold text-gray-900">Compatibility:</span>{' '}
                        {match.compatibility}
                      </p>
                    )
                  })()}
                  <div className="mt-2 mb-3 flex items-center gap-4 text-xs text-gray-500 whitespace-nowrap overflow-hidden">
                    {match.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <div className="mt-auto flex gap-3">
                    {isApplied ? (
                      <span className="flex flex-1 items-center justify-center gap-2 rounded-lg gradient-primary px-4 py-3 text-sm font-medium text-white">
                        Applied
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleApplyNow(match)}
                        className="w-full rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white"
                      >
                        Apply Now
                      </button>
                    )}
                  </div>
                  {isApplied && applicationIdByPropertyId[match.id] ? (
                    <Link
                      to={`/account/application/${applicationIdByPropertyId[match.id]}`}
                      className="mt-2 block text-center text-sm font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:text-gray-950"
                    >
                      Application status
                    </Link>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {hasMatches &&
        tenantBaseMatches.length > TENANT_MATCHES_PAGE_SIZE ? (
        <div className="flex justify-center">
          <div className="mt-1 flex items-center gap-3">
            <button
              type="button"
              onClick={() => setTenantPage((p) => Math.max(1, p - 1))}
              disabled={tenantPage === 1}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {tenantPage} of {tenantTotalPages}
            </span>
            <button
              type="button"
              onClick={() => setTenantPage((p) => Math.min(tenantTotalPages, p + 1))}
              disabled={tenantPage === tenantTotalPages}
              className="rounded-lg border border-gray-300 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      ) : null}

      {profileRole === 'tenant' && tenantOverallScore != null && (loading || matchLoading) && matchesToShow.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-600">Loading your matches…</p>
        </div>
      ) : null}

      {!hasMatches && !loading && !(profileRole === 'tenant' && tenantOverallScore != null && matchLoading) ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-xl border border-gray-200">
          <div className="w-32 h-32 rounded-xl bg-gray-100 flex items-center justify-center mb-6">
            <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
          {activeTab === 'saved' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Saved Properties Yet</h2>
              <p className="text-gray-600 text-center max-w-md mb-8">
                Tap the heart on any match to save it here for later.
              </p>
              <button
                type="button"
                onClick={() => commitTenantMatchesTab('all')}
                className="inline-flex items-center gap-2 px-6 py-3 btn-primary text-white font-medium rounded-lg"
              >
                Browse Matches
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : activeTab === 'applied' ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No applications yet</h2>
              <p className="text-gray-600 text-center max-w-md mb-8">
                When you apply to a listing from your matches, it will show up here. You can also open{' '}
                <Link
                  to="/account/rental-application"
                  className="font-medium text-gray-900 underline decoration-gray-300 underline-offset-2 hover:text-gray-950"
                >
                  your rental application
                </Link>{' '}
                from your profile.
              </p>
              <button
                type="button"
                onClick={() => commitTenantMatchesTab('all')}
                className="inline-flex items-center gap-2 px-6 py-3 btn-primary text-white font-medium rounded-lg"
              >
                Browse matches
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          ) : profileRole === 'tenant' && tenantOverallScore != null ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No matches right now</h2>
              <p className="text-gray-600 text-center max-w-md mb-8">
                No properties match your profile yet. Try adjusting filters or check back later for new listings.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">No Matches Yet</h2>
              <p className="text-gray-600 text-center max-w-md mb-8">
                Adjust your lease preferences or you can complete your application. Once you apply you can submit your application for any property.
              </p>
              <Link
                to="/applications/apply"
                className="inline-flex items-center gap-2 px-6 py-3 btn-primary text-white font-medium rounded-lg"
              >
                Complete Application
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </>
          )}
        </div>
      ) : null}

      {submissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 p-4">
          <div className="w-full max-w-[304px] rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-900">
              <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="mb-2 text-center text-[2rem] font-medium leading-tight text-gray-900">Application Submitted!</h2>
            <p className="mb-5 text-center text-sm text-gray-600">
              Your application for {submissionModal.propertyTitle} has been successfully submitted to the landlord.
            </p>
            <div className="mb-5 space-y-3">
              <div className="flex gap-2.5">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-gray-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">What happens next?</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-600">The landlord will review your application and respond within 2-3 business days.</p>
                </div>
              </div>
              <div className="flex gap-2.5">
                <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-gray-700">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Stay updated</h3>
                  <p className="mt-1 text-xs leading-5 text-gray-600">We'll notify you via email and in-app notifications when there's an update.</p>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSubmissionModal(null)}
              className="w-full rounded-lg btn-primary py-3 text-sm font-medium text-white"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
      </>
      ) : null}
    </div>
  )
}
