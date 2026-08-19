export type PlaidVerificationRow = {
  institution_name: string | null
  accounts_count: number | null
  income_verified: boolean | null
  balances_verified: boolean | null
  debts_verified: boolean | null
  dti_ratio: number | string | null
  identity_verified: boolean | null
  monthly_income_range_low_cents: number | null
  monthly_income_range_high_cents: number | null
  asset_tier: string | null
  last_verified_at: string | null
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  )
}

function ScoreRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <dt className="text-sm text-gray-700">{label}</dt>
      <dd>
        {ok ? (
          <span className="inline-flex items-center gap-1 text-sm font-medium text-green-700">
            <CheckIcon /> Verified
          </span>
        ) : (
          <span className="text-xs text-gray-400">Not verified</span>
        )}
      </dd>
    </div>
  )
}

function formatDate(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100)
}

const ASSET_TIER_LABELS: Record<string, string> = {
  low: '< 1 month reserves',
  moderate: '1–3 months reserves',
  high: '3–6 months reserves',
  very_high: '6+ months reserves',
}

function LockIcon() {
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
      />
    </svg>
  )
}

/**
 * Read-only bank-verification scorecard shown to landlords on a tenant profile.
 *
 * - When `unlocked` is false (or omitted): shows verification signals only
 *   (Income ✓ / Identity ✓ / Funds ✓) with specific numbers hidden behind a
 *   blur overlay and an "Unlock to view details" prompt.
 * - When `unlocked` is true: shows signals + income range, asset tier, and DTI.
 *
 * Raw figures and PII are never stored or returned; the extra detail here
 * comes from the range/tier columns added in the 20260729 migration.
 */
export function BankVerificationCard({
  verification,
  unlocked = false,
  docusignVerified = true,
  onSignAgreements,
}: {
  verification: PlaidVerificationRow | null
  unlocked?: boolean
  /** False when the landlord hasn't signed the required Plaid/Equifax agreements yet. */
  docusignVerified?: boolean
  onSignAgreements?: () => void
}) {
  const v = verification
  const hasAny = !!(
    v &&
    (v.income_verified || v.balances_verified || v.debts_verified || v.identity_verified)
  )

  if (!docusignVerified) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-1 text-base font-semibold tracking-tight text-gray-900">Bank verification</h2>
        <p className="mt-3 text-sm text-gray-500">
          Sign the required agreements to view this tenant's bank verification data.
        </p>
        {onSignAgreements && (
          <button type="button" onClick={onSignAgreements} className="mt-2 text-sm font-medium text-gray-900 underline">
            Sign agreements
          </button>
        )}
      </section>
    )
  }
  const dtiNum = v && v.dti_ratio != null ? Number(v.dti_ratio) : NaN
  const dtiPct = Number.isFinite(dtiNum) ? Math.round(dtiNum * 100) : null
  const verifiedAt = v?.last_verified_at ? formatDate(v.last_verified_at) : null

  const hasIncomeRange =
    v?.monthly_income_range_low_cents != null && v?.monthly_income_range_high_cents != null
  const hasAssetTier = !!v?.asset_tier

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-base font-semibold tracking-tight text-gray-900">Bank verification</h2>

      {!hasAny ? (
        <p className="mt-3 text-sm text-gray-500">
          This tenant hasn't verified their finances with a bank yet.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            {v!.institution_name
              ? `Verified via ${v!.institution_name}${
                  v!.accounts_count ? ` · ${v!.accounts_count} account${v!.accounts_count === 1 ? '' : 's'}` : ''
                }`
              : "Verified via the tenant\u2019s bank (Plaid)."}
          </p>

          {/* Signals row — always visible */}
          <dl className="divide-y divide-gray-100 rounded-lg border border-gray-100">
            <ScoreRow label="Income" ok={!!v!.income_verified} />
            <ScoreRow label="Identity" ok={!!v!.identity_verified} />
            <ScoreRow label="Funds available" ok={!!v!.balances_verified} />
            <div className="flex items-center justify-between px-3 py-2.5">
              <dt className="text-sm text-gray-700">Debt-to-income</dt>
              <dd>
                {dtiPct !== null ? (
                  <span
                    className={`text-sm font-semibold ${
                      dtiPct <= 36 ? 'text-green-700' : dtiPct <= 43 ? 'text-amber-600' : 'text-red-600'
                    }`}
                  >
                    {dtiPct}%
                  </span>
                ) : (
                  <span className="text-xs text-gray-400">Not available</span>
                )}
              </dd>
            </div>
          </dl>

          {/* Detailed numbers — visible when unlocked, blurred otherwise */}
          {(hasIncomeRange || hasAssetTier) && (
            <div className="relative mt-3">
              <dl
                className={`divide-y divide-gray-100 rounded-lg border border-gray-100 ${
                  !unlocked ? 'select-none blur-sm' : ''
                }`}
                aria-hidden={!unlocked}
              >
                {hasIncomeRange && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <dt className="text-sm text-gray-700">Monthly income range</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {formatMoney(v!.monthly_income_range_low_cents!)}–
                      {formatMoney(v!.monthly_income_range_high_cents!)}
                    </dd>
                  </div>
                )}
                {hasAssetTier && (
                  <div className="flex items-center justify-between px-3 py-2.5">
                    <dt className="text-sm text-gray-700">Asset reserves</dt>
                    <dd className="text-sm font-medium text-gray-900">
                      {ASSET_TIER_LABELS[v!.asset_tier!] ?? v!.asset_tier}
                    </dd>
                  </div>
                )}
              </dl>

              {!unlocked && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/60">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 shadow-sm">
                    <LockIcon />
                    Unlock profile to view
                  </span>
                </div>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-gray-400">
            Only verification signals are shared — never account numbers, balances, or transactions.
            {verifiedAt ? ` Last verified ${verifiedAt}.` : ''}
          </p>
        </>
      )}
    </section>
  )
}
