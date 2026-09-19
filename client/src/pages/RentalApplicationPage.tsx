import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { usePlaidLink } from 'react-plaid-link'
import { useAuth } from '../lib/useAuth'
import { useProfileRole } from '../lib/useProfileRole'
import { supabase } from '../lib/supabase'
import { getConsentStatus, saveConsentData } from '../lib/equifaxApi'
import { createPlaidLinkToken, exchangePlaidPublicToken, getPlaidVerification, type PlaidVerification } from '../lib/plaidApi'

type Profile = {
  display_name: string; phone: string; bio: string; city: string
  date_of_birth: string; address_line1: string; address_line2: string
  state: string; postal_code: string; emergency_contact_name: string
  emergency_contact_relationship: string; emergency_contact_phone: string
}
type Universal = { id: string; status: string; valid_until: string; created_at: string; wizard_completed_at: string | null; triggering_property_id: string | null }
type Form = Profile & { bio: string; leaseIntent: string; moveInDate: string; budget: string }
const steps = ['Personal information', 'Emergency contact', 'Your plans', 'Authorization', 'Income verification']
const states = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']
const budgetRanges: Record<string, { min: number; max: number }> = {
  under_1200: { min: 0, max: 120000 },
  '1200_1800': { min: 120000, max: 180000 },
  '1800_2500': { min: 180000, max: 250000 },
  over_2500: { min: 250000, max: 1000000 },
}
const leaseMonths: Record<string, number> = { long_term: 12, short_term: 6, flexible: 9 }

function budgetKey(min: number | null, max: number | null): string {
  if (max != null && max <= 120000) return 'under_1200'
  if (max != null && max <= 180000) return '1200_1800'
  if (max != null && max <= 250000) return '1800_2500'
  return min != null && min >= 250000 ? 'over_2500' : ''
}

function leaseIntent(months: number | null): string {
  if (months == null) return ''
  if (months >= 12) return 'long_term'
  if (months <= 6) return 'short_term'
  return 'flexible'
}

function equifaxAddress(address: string): { houseNumber: string; streetName: string; streetType: string } {
  const parts = address.trim().split(/\s+/)
  const houseNumber = parts.shift() || ''
  const knownTypes = new Set(['ST','AVE','BLVD','DR','RD','LN','CT','PL','WAY','CIR'])
  const possibleType = (parts.at(-1) || '').replace(/\./g, '').toUpperCase()
  const streetType = knownTypes.has(possibleType) ? possibleType : 'ST'
  if (knownTypes.has(possibleType)) parts.pop()
  return { houseNumber, streetName: parts.join(' '), streetType }
}

function Icon({ kind, className = 'h-5 w-5' }: { kind: 'check' | 'lock' | 'arrow' | 'back' | 'shield'; className?: string }) {
  const paths = { check: 'M5 13l4 4L19 7', arrow: 'M5 12h14m-6-6 6 6-6 6', back: 'M19 12H5m6 6-6-6 6-6', lock: 'M7 10V8a5 5 0 0110 0v2m-9 0h8a2 2 0 012 2v7H6v-7a2 2 0 012-2z', shield: 'M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z' }
  return <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d={paths[kind]} /></svg>
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-[#315166]">{label}</span>{children}{hint && <span className="mt-1.5 block text-xs text-[#7893a0]">{hint}</span>}</label>
}
const input = 'w-full rounded-xl border border-[#c9dce3] bg-[#fbfdfd] px-3.5 py-3 text-sm text-[#173b4d] outline-none transition focus:border-[#159b9a] focus:ring-4 focus:ring-[#159b9a]/10'
const blankProfile: Profile = { display_name: '', phone: '', bio: '', city: '', date_of_birth: '', address_line1: '', address_line2: '', state: '', postal_code: '', emergency_contact_name: '', emergency_contact_relationship: '', emergency_contact_phone: '' }

export function RentalApplicationPage() {
  const { user } = useAuth()
  const { role, loading: roleLoading } = useProfileRole(user)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState<Form>({ ...blankProfile, leaseIntent: '', moveInDate: '', budget: '' })
  const [universal, setUniversal] = useState<Universal | null>(null)
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consent, setConsent] = useState<boolean | null>(null)
  const [authorized, setAuthorized] = useState(false)
  const [ssn, setSsn] = useState('')
  const [plaid, setPlaid] = useState<PlaidVerification | null>(null)
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidBusy, setPlaidBusy] = useState(false)
  const [reviewing, setReviewing] = useState(false)
  const [triggerReady, setTriggerReady] = useState(false)
  const needsIncome = !plaid?.incomeVerified
  const visibleSteps = needsIncome ? steps : steps.slice(0, 4)

  const update = (key: keyof Form, value: string) => setForm((old) => ({ ...old, [key]: value }))
  const getToken = async () => (await supabase.auth.getSession()).data.session?.access_token ?? null

  useEffect(() => {
    if (!user || role !== 'tenant') { setLoading(false); return }
    let cancelled = false
    ;(async () => {
      const [{ data: p }, { data: privateProfile }, { data: a }, { data: preferences }] = await Promise.all([
        supabase.from('profiles').select('display_name,phone,bio,city').eq('id', user.id).maybeSingle(),
        supabase.from('tenant_application_profiles').select('date_of_birth,address_line1,address_line2,city,state,postal_code,emergency_contact_name,emergency_contact_relationship,emergency_contact_phone').eq('tenant_id', user.id).maybeSingle(),
        supabase.from('universal_applications').select('id,status,valid_until,created_at,wizard_completed_at,triggering_property_id').eq('tenant_id', user.id).order('created_at', { ascending: false }).limit(1),
        supabase.from('tenant_preferences').select('move_in_date,lease_length_months,min_budget_cents,max_budget_cents').eq('user_id', user.id).maybeSingle(),
      ])
      if (cancelled) return
      const next = { ...blankProfile, ...(p as Partial<Profile> ?? {}), ...(privateProfile as Partial<Profile> ?? {}) }
      const normalized = Object.fromEntries(Object.entries(next).map(([key, value]) => [key, value ?? ''])) as Profile
      setForm({
        ...normalized,
        leaseIntent: leaseIntent(preferences?.lease_length_months ?? null),
        moveInDate: preferences?.move_in_date ?? '',
        budget: budgetKey(preferences?.min_budget_cents ?? null, preferences?.max_budget_cents ?? null),
      })
      const loadedUniversal = ((a ?? [])[0] as Universal) ?? null
      setUniversal(loadedUniversal)
      setTriggerReady(Boolean(loadedUniversal?.triggering_property_id) || !params.get('propertyId'))
      try { const token = await getToken(); if (token) { const hasConsent = (await getConsentStatus(token)).hasConsent; setConsent(hasConsent); setAuthorized(hasConsent); setPlaid(await getPlaidVerification(token)) } } catch { /* status is optional and can be retried in the wizard */ }
      setLoading(false)
    })().catch(() => { setError('We could not load your application. Please try again.'); setLoading(false) })
    return () => { cancelled = true }
  }, [user, role])

  const isActive = Boolean(universal && universal.status === 'active' && new Date(universal.valid_until).getTime() > Date.now())
  const completed = Boolean(universal?.wizard_completed_at)
  const propertyId = universal?.triggering_property_id ?? params.get('propertyId') ?? null
  const title = completed && !reviewing ? 'Your application is ready' : 'A clearer way to apply'
  const sub = completed && !reviewing ? 'Your application is on file and ready to share with properties.' : 'Complete this once, then apply to homes with confidence.'

  useEffect(() => {
    if (!linkToken) return
    const token = linkToken
    // Plaid's hook opens when its SDK is ready below.
    void token
  }, [linkToken])
  const { open, ready } = usePlaidLink({ token: linkToken, onSuccess: async (publicToken) => {
    setPlaidBusy(true); setError(null)
    try { const token = await getToken(); if (!token) throw new Error('Please sign in again.'); setPlaid(await exchangePlaidPublicToken(token, publicToken)); setLinkToken(null) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not verify your income.') }
    finally { setPlaidBusy(false) }
  }, onExit: () => { setLinkToken(null); setPlaidBusy(false) } })
  useEffect(() => { if (linkToken && ready) open() }, [linkToken, ready, open])

  useEffect(() => {
    if (plaid?.status !== 'processing') return
    const interval = window.setInterval(async () => {
      const token = await getToken()
      if (!token) return
      getPlaidVerification(token).then(setPlaid).catch(() => {})
    }, 8000)
    return () => window.clearInterval(interval)
  }, [plaid?.status])

  useEffect(() => {
    if (!propertyId || universal?.triggering_property_id || !user || !isActive || completed) return
    let cancelled = false
    ;(async () => {
      const token = await getToken()
      if (!token) throw new Error('Your session expired. Please sign in again.')
      const response = await fetch('/api/universal-application/triggering-property', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ propertyId }),
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error((body as { error?: string }).error || 'Could not save the selected property.')
      if (!cancelled) {
        const confirmedPropertyId = (body as { propertyId?: string }).propertyId || propertyId
        setUniversal((current) => current ? { ...current, triggering_property_id: confirmedPropertyId } : current)
        setTriggerReady(true)
      }
    })().catch((e) => {
      if (!cancelled) {
        setTriggerReady(false)
        setError(e instanceof Error ? e.message : 'Could not save the selected property.')
      }
    })
    return () => { cancelled = true }
  }, [propertyId, universal?.triggering_property_id, user, isActive, completed])

  async function saveProgress() {
    if (!user) return false
    setSaving(true); setError(null)
    try {
      const { error: profileError } = await supabase.from('profiles').update({
        display_name: form.display_name, phone: form.phone, bio: form.bio, city: form.city,
      }).eq('id', user.id)
      if (profileError) throw profileError
      const { error: privateProfileError } = await supabase.from('tenant_application_profiles').upsert({
        tenant_id: user.id, date_of_birth: form.date_of_birth, address_line1: form.address_line1,
        address_line2: form.address_line2, city: form.city, state: form.state, postal_code: form.postal_code,
        emergency_contact_name: form.emergency_contact_name, emergency_contact_relationship: form.emergency_contact_relationship, emergency_contact_phone: form.emergency_contact_phone,
      }, { onConflict: 'tenant_id' })
      if (privateProfileError) throw privateProfileError
      const range = budgetRanges[form.budget]
      if (range && form.leaseIntent && form.moveInDate) {
        const { error: preferencesError } = await supabase.from('tenant_preferences').upsert({
          user_id: user.id,
          move_in_date: form.moveInDate,
          lease_length_months: leaseMonths[form.leaseIntent],
          min_budget_cents: range.min,
          max_budget_cents: range.max,
        }, { onConflict: 'user_id' })
        if (preferencesError) throw preferencesError
      }
      return true
    } catch { setError('Your progress could not be saved. Please try again.'); return false } finally { setSaving(false) }
  }

  function valid() {
    if (step === 0) return Boolean(form.display_name && form.phone && form.date_of_birth && form.address_line1 && form.city && form.state && form.postal_code)
    if (step === 1) return Boolean(form.emergency_contact_name && form.emergency_contact_relationship && form.emergency_contact_phone)
    if (step === 2) return Boolean(form.bio && form.leaseIntent && form.moveInDate && form.budget)
    if (step === 3) return Boolean(authorized && (consent || ssn.replace(/\D/g, '').length === 9))
    return Boolean(plaid?.incomeVerified)
  }
  async function next() {
    if (!valid()) { setError(step === 3 ? 'Please complete the authorization to continue.' : 'Please complete the highlighted information before continuing.'); return }
    if (step === visibleSteps.length - 1 && propertyId && !triggerReady) {
      setError('We are still saving the property you selected. Please try again in a moment.')
      return
    }
    const token = await getToken()
    if (!token) { setError('Your session expired. Please sign in again.'); return }
    if (step === 3 && !consent) {
      setSaving(true)
      setError(null)
      try {
        const digits = ssn.replace(/\D/g, '')
        const address = equifaxAddress(form.address_line1)
        await saveConsentData(token, {
          firstName: form.display_name.split(' ')[0],
          lastName: form.display_name.split(' ').slice(1).join(' ') || form.display_name,
          ssn: digits,
          dateOfBirth: form.date_of_birth,
          ...address,
          city: form.city,
          state: form.state,
          zip: form.postal_code,
        })
        setSsn('')
        setConsent(true)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not save your authorization.')
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }
    if (step < visibleSteps.length - 1) { if (await saveProgress()) setStep(step + 1); return }
    setSaving(true); setError(null)
    try {
      if (!(await saveProgress())) throw new Error('Your progress could not be saved.')
      const res = await fetch('/api/universal-application/complete', { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error((body as { error?: string }).error || 'We could not finish your application. Please try again.')
      }
      navigate('/matches?tab=applied')
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not complete your application.') } finally { setSaving(false) }
  }

  async function startPlaid() {
    try { setPlaidBusy(true); const token = await getToken(); if (!token) throw new Error('Please sign in again.'); setLinkToken(await createPlaidLinkToken(token)) }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not start income verification.') } finally { setPlaidBusy(false) }
  }

  if (loading || roleLoading) return <div className="mx-auto max-w-3xl px-4 py-12"><div className="h-8 w-64 animate-pulse rounded bg-[#dcebef]" /><div className="mt-5 h-72 animate-pulse rounded-3xl bg-[#edf5f5]" /></div>
  if (role !== 'tenant') return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="text-2xl font-semibold text-[#173b4d]">This path is for tenants</h1><p className="mt-2 text-sm text-[#66828f]">Sign in with a tenant account to manage your rental application.</p></div>
  if (!isActive && !completed) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e4f4f1] text-[#087f82]"><Icon kind="lock" className="h-7 w-7" /></div><h1 className="mt-6 text-2xl font-semibold text-[#173b4d]">Your application is not active yet</h1><p className="mt-2 text-sm leading-6 text-[#66828f]">Start your paid application first. Once active, we will keep your progress safe as you complete each step.</p><Link to="/applications/apply" className="mt-6 inline-flex rounded-xl bg-[#087f82] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#087f82]/15">Start application</Link></div>

  return <main className="min-h-[calc(100dvh-4rem)] bg-[linear-gradient(135deg,#f6fbfb_0%,#f9fcfb_55%,#eef8f7_100%)] px-4 py-7 sm:py-10">
    <div className="mx-auto max-w-5xl">
      <Link to="/matches?tab=applied" className="inline-flex items-center gap-2 text-sm font-medium text-[#567381] transition hover:text-[#087f82]"><Icon kind="back" className="h-4 w-4" />Back to applied homes</Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[.72fr_1.28fr]">
        <aside className="lg:pt-5"><p className="text-xs font-bold uppercase tracking-[.18em] text-[#087f82]">Rental City / Application</p><h1 className="mt-4 max-w-sm text-4xl font-semibold leading-[1.08] tracking-[-.03em] text-[#173b4d] sm:text-5xl">{title}</h1><p className="mt-4 max-w-sm text-base leading-7 text-[#66828f]">{sub}</p><div className="mt-8 rounded-2xl border border-[#cfe8e5] bg-[#eff9f7] p-4 text-sm leading-6 text-[#315d68]"><Icon kind="shield" className="mb-2 h-5 w-5 text-[#087f82]" /><strong className="block text-[#173b4d]">Your information stays yours.</strong> Sensitive details are encrypted in transit and never shown to landlords.</div></aside>
        <section className="overflow-hidden rounded-3xl border border-[#d9e8e7] bg-white shadow-[0_24px_70px_rgba(23,59,77,.09)]">
          {completed && !reviewing ? <div className="p-7 sm:p-10"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#dff4ed] text-[#087f82]"><Icon kind="check" className="h-7 w-7" /></div><h2 className="mt-6 text-2xl font-semibold text-[#173b4d]">Everything is in place.</h2><p className="mt-2 max-w-md text-sm leading-6 text-[#66828f]">Your universal application was completed {universal?.wizard_completed_at ? new Date(universal.wizard_completed_at).toLocaleDateString() : 'recently'}. You can now apply to homes without repeating this information.</p><div className="mt-8 flex flex-wrap gap-3"><Link to="/matches?tab=applied" className="rounded-xl bg-[#087f82] px-5 py-3 text-sm font-semibold text-white">View applied homes</Link><button type="button" onClick={() => setReviewing(true)} className="rounded-xl border border-[#c9dce3] px-5 py-3 text-sm font-semibold text-[#315166]">Review or update</button></div></div> : <><div className="border-b border-[#e4efee] px-6 py-6 sm:px-9"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-semibold text-[#66828f]">Step {step + 1} of {visibleSteps.length}</p><h2 className="mt-1 text-xl font-semibold text-[#173b4d]">{visibleSteps[step]}</h2></div><span className="text-sm font-semibold text-[#087f82]">{Math.round(((step + 1) / visibleSteps.length) * 100)}%</span></div><div className="mt-5 flex gap-1.5">{visibleSteps.map((_, i) => <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i <= step ? 'bg-[#159b9a]' : 'bg-[#e1eeee]'}`} />)}</div></div><div key={step} className="signup-enter px-6 py-7 sm:px-9 sm:py-9">
            {step === 0 && <><p className="mb-6 text-sm leading-6 text-[#66828f]">We filled this from your profile. Take a moment to confirm it is accurate before sharing with a property.</p><div className="grid gap-4 sm:grid-cols-2"><Field label="Full name"><input data-testid="input-full-name" className={input} value={form.display_name ?? ''} onChange={e => update('display_name', e.target.value)} /></Field><Field label="Email"><input data-testid="input-email" className={`${input} bg-[#f2f7f7]`} value={user?.email ?? ''} readOnly /></Field><Field label="Phone"><input data-testid="input-phone" className={input} value={form.phone ?? ''} onChange={e => update('phone', e.target.value)} /></Field><Field label="Date of birth"><input data-testid="input-date-of-birth" type="date" className={input} value={form.date_of_birth ?? ''} onChange={e => update('date_of_birth', e.target.value)} /></Field><Field label="Address line 1"><input data-testid="input-address-line1" className={input} value={form.address_line1 ?? ''} onChange={e => update('address_line1', e.target.value)} /></Field><Field label="Address line 2"><input data-testid="input-address-line2" className={input} value={form.address_line2 ?? ''} onChange={e => update('address_line2', e.target.value)} placeholder="Apartment, suite, etc. (optional)" /></Field><Field label="City"><input data-testid="input-city" className={input} value={form.city ?? ''} onChange={e => update('city', e.target.value)} /></Field><div className="grid grid-cols-2 gap-3"><Field label="State"><select data-testid="input-state" className={input} value={form.state ?? ''} onChange={e => update('state', e.target.value)}><option value="">Select</option>{states.map(s => <option key={s}>{s}</option>)}</select></Field><Field label="ZIP code"><input data-testid="input-postal-code" className={input} value={form.postal_code ?? ''} onChange={e => update('postal_code', e.target.value.replace(/\D/g, '').slice(0, 5))} /></Field></div></div></>}
            {step === 1 && <><p className="mb-6 text-sm leading-6 text-[#66828f]">Who should we contact in an emergency? This person will not be contacted during routine application review.</p><div className="space-y-4"><Field label="Contact name"><input data-testid="input-emergency-name" className={input} value={form.emergency_contact_name ?? ''} onChange={e => update('emergency_contact_name', e.target.value)} placeholder="Full name" /></Field><Field label="Relationship"><input data-testid="input-emergency-relationship" className={input} value={form.emergency_contact_relationship ?? ''} onChange={e => update('emergency_contact_relationship', e.target.value)} placeholder="Parent, partner, sibling..." /></Field><Field label="Phone number"><input data-testid="input-emergency-phone" className={input} value={form.emergency_contact_phone ?? ''} onChange={e => update('emergency_contact_phone', e.target.value)} /></Field></div></>}
            {step === 2 && <><p className="mb-6 text-sm leading-6 text-[#66828f]">This short profile helps landlords understand what you are looking for. You can update it later.</p><div className="space-y-4"><Field label="A little about you"><textarea data-testid="input-bio" className={`${input} min-h-28 resize-y`} value={form.bio ?? ''} onChange={e => update('bio', e.target.value)} placeholder="Tell a landlord what makes you a thoughtful tenant..." /></Field><Field label="Lease intent"><select data-testid="input-lease-intent" className={input} value={form.leaseIntent} onChange={e => update('leaseIntent', e.target.value)}><option value="">Choose an option</option><option value="long_term">Long-term home</option><option value="short_term">Short-term lease</option><option value="flexible">Open to either</option></select></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Ideal move-in date"><input data-testid="input-move-in-date" type="date" className={input} value={form.moveInDate} onChange={e => update('moveInDate', e.target.value)} /></Field><Field label="Monthly budget"><select data-testid="input-budget" className={input} value={form.budget} onChange={e => update('budget', e.target.value)}><option value="">Choose a range</option><option value="under_1200">Under $1,200</option><option value="1200_1800">$1,200 – $1,800</option><option value="1800_2500">$1,800 – $2,500</option><option value="over_2500">Over $2,500</option></select></Field></div></div></>}
             {step === 3 && <><div className="mb-6 rounded-2xl border border-[#cfe8e5] bg-[#eff9f7] p-4"><div className="flex gap-3"><Icon kind="lock" className="mt-0.5 h-5 w-5 shrink-0 text-[#087f82]" /><p className="text-sm leading-6 text-[#315d68]"><strong className="text-[#173b4d]">One secure authorization.</strong> Approved landlords can request a credit and background check. Your Social Security number is encrypted immediately and never stored in plain text.</p></div></div>{consent ? <div className="rounded-2xl border border-[#bfe4d6] bg-[#eefaf4] p-4 text-sm text-[#267052]">Authorization is already on file. You are ready to continue.</div> : <div className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Legal first name"><input data-testid="input-legal-first-name" className={input} value={form.display_name.split(' ')[0] ?? ''} onChange={e => update('display_name', `${e.target.value} ${form.display_name.split(' ').slice(1).join(' ')}`.trim())} /></Field><Field label="Legal last name"><input data-testid="input-legal-last-name" className={input} value={form.display_name.split(' ').slice(1).join(' ')} onChange={e => update('display_name', `${form.display_name.split(' ')[0]} ${e.target.value}`.trim())} /></Field></div><Field label="Social Security number" hint="Used once to send an encrypted authorization to Equifax."><input data-testid="input-ssn" className={input} type="password" inputMode="numeric" autoComplete="off" value={ssn} onChange={e => setSsn(e.target.value.replace(/\D/g, '').slice(0, 9))} placeholder="9 digits" /></Field><label className="flex items-start gap-3 rounded-xl border border-[#d9e8e7] p-4 text-sm leading-5 text-[#315166]"><input data-testid="input-authorization" type="checkbox" className="mt-1 accent-[#087f82]" checked={authorized} onChange={e => setAuthorized(e.target.checked)} />I authorize Rental City and approved landlords to request a credit and background check on my behalf.</label></div>}</>}
            {step === 4 && <><p className="mb-6 text-sm leading-6 text-[#66828f]">Connect securely through Plaid so landlords can see a verified income signal, not your bank details.</p><div className="rounded-2xl border border-[#d9e8e7] bg-[#fbfdfd] p-5">{plaid?.incomeVerified ? <div className="flex items-center gap-3 text-[#267052]"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#dff4ed]"><Icon kind="check" /></span><div><p className="font-semibold">Income verified</p><p className="text-xs text-[#66828f]">{plaid.institutionName ? `Connected to ${plaid.institutionName}.` : 'Your verification is complete.'}</p></div></div> : <><div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e4f4f1] text-[#087f82]"><Icon kind="shield" /></div><div><p className="font-semibold text-[#173b4d]">Private by design</p><p className="text-xs text-[#66828f]">We keep the verification result, never account numbers.</p></div></div><button data-testid="button-connect-bank" type="button" onClick={() => void startPlaid()} disabled={plaidBusy} className="mt-5 w-full rounded-xl bg-[#087f82] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">{plaidBusy ? 'Connecting...' : 'Verify income with Plaid'}</button></>}</div></>}
            {error && <p data-testid="status-application-error" className="mt-5 rounded-xl bg-[#fff1ef] px-4 py-3 text-sm text-[#ad4d42]">{error}</p>}
            <div className="mt-8 flex items-center justify-between gap-3 border-t border-[#e4efee] pt-5"><button data-testid="button-back-step" type="button" disabled={step === 0 || saving} onClick={() => setStep(Math.max(0, step - 1))} className="inline-flex items-center gap-2 rounded-xl px-2 py-3 text-sm font-semibold text-[#66828f] disabled:invisible"><Icon kind="back" className="h-4 w-4" />Back</button><button data-testid="button-next-step" type="button" disabled={saving || plaidBusy} onClick={() => void next()} className="inline-flex items-center gap-2 rounded-xl bg-[#087f82] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#087f82]/15 transition hover:bg-[#066c70] disabled:opacity-60">{saving ? 'Saving...' : step === visibleSteps.length - 1 ? 'Finish application' : 'Save and continue'}<Icon kind="arrow" className="h-4 w-4" /></button></div>
          </div></>}
        </section>
      </div>
    </div>
  </main>
}