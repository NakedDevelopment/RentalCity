export type PlaidVerificationRow = {
  institution_name: string | null
  accounts_count: number | null
  income_verified: boolean | null
  balances_verified: boolean | null
  debts_verified: boolean | null
  dti_ratio: number | string | null
  identity_verified: boolean | null
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

/**
 * Read-only bank-verification scorecard shown to landlords on a tenant profile.
 * Renders ONLY verification signals (income / identity / funds + DTI%) — never
 * raw figures or PII, matching the tenant-side scorecard and the data-minimized
 * `plaid_financial_verifications` table.
 */
export function BankVerificationCard({ verification }: { verification: PlaidVerificationRow | null }) {
  const v = verification
  const hasAny = !!(
    v &&
    (v.income_verified || v.balances_verified || v.debts_verified || v.identity_verified)
  )
  const dtiNum = v && v.dti_ratio != null ? Number(v.dti_ratio) : NaN
  const dtiPct = Number.isFinite(dtiNum) ? Math.round(dtiNum * 100) : null
  const verifiedAt = v?.last_verified_at ? formatDate(v.last_verified_at) : null

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-1 text-base font-semibold tracking-tight text-gray-900">Bank verification</h2>

      {!hasAny ? (
        <p className="mt-3 text-sm text-gray-500">
          This tenant hasn’t verified their finances with a bank yet.
        </p>
      ) : (
        <>
          <p className="mb-3 text-xs text-gray-500">
            {v!.institution_name
              ? `Verified via ${v!.institution_name}${
                  v!.accounts_count ? ` · ${v!.accounts_count} account${v!.accounts_count === 1 ? '' : 's'}` : ''
                }`
              : 'Verified via the tenant’s bank (Plaid).'}
          </p>

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

          <p className="mt-3 text-xs text-gray-400">
            Only verification signals are shared — never account numbers, balances, or transactions.
            {verifiedAt ? ` Last verified ${verifiedAt}.` : ''}
          </p>
        </>
      )}
    </section>
  )
}
