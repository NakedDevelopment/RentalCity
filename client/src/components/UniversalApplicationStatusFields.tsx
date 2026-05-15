import type { ReactNode } from 'react'

/** Shared with tenant Account CTA and landlord read-only notice so both match visually. */
export const UNIVERSAL_APPLICATION_STATUS_ACTION_CLASS =
  'flex w-full min-h-[44px] items-center justify-between gap-3 rounded-lg gradient-primary px-4 py-3 text-sm font-medium text-white'

type Props = {
  statusLabel: string
  validUntilText: string
  remainingText: string
  remainingBarWidthPct: number
  /** Highlights “Active” when the universal window is still open (tenant view). */
  isUniversalActive?: boolean
  /** When false, only status + valid-until rows (e.g. landlord view). Default true. */
  showTimeline?: boolean
  /** e.g. tenant “Update rental application” full-width link */
  action?: ReactNode
  /** e.g. landlord-only note below the bar */
  footerHint?: ReactNode
}

function statusValueClass(statusLabel: string, isUniversalActive: boolean): string {
  if (statusLabel === 'Active' && isUniversalActive) {
    return 'inline-flex items-center rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-900 ring-1 ring-inset ring-emerald-800/10'
  }
  if (statusLabel === 'Expired') {
    return 'inline-flex items-center rounded-md bg-amber-50 px-2.5 py-1 text-sm font-semibold text-amber-950 ring-1 ring-inset ring-amber-800/12'
  }
  if (statusLabel === 'Withdrawn') {
    return 'text-sm font-semibold text-gray-700'
  }
  return 'text-sm font-semibold text-gray-900'
}

/** Application Status body: same layout for tenant Account and landlord tenant profile. */
export function UniversalApplicationStatusFields({
  statusLabel,
  validUntilText,
  remainingText,
  remainingBarWidthPct,
  isUniversalActive = false,
  showTimeline = true,
  action,
  footerHint,
}: Props) {
  return (
    <div className="space-y-0">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 border-b border-gray-100 pb-3.5">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Current status</span>
        <span
          className={`justify-self-end text-right ${statusValueClass(statusLabel, isUniversalActive)}`}
        >
          {statusLabel}
        </span>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 pt-3.5">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Valid until</span>
        <span className="justify-self-end whitespace-nowrap text-right text-sm font-semibold tabular-nums text-gray-900">
          {validUntilText}
        </span>
      </div>
      {showTimeline ? (
        <div className="mt-4 border-t border-gray-100 pt-3.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-gray-900 transition-[width]"
              style={{ width: `${remainingBarWidthPct}%` }}
            />
          </div>
          <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{remainingText}</p>
        </div>
      ) : null}
      {action ? <div className="pt-4">{action}</div> : null}
      {footerHint ? <div className="pt-2">{footerHint}</div> : null}
    </div>
  )
}
