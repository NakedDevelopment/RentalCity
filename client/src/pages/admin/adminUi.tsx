/** Shared admin portal visuals (aligned with main app shell + gray scale). */
export const admin = {
  pageTitle: 'text-2xl font-semibold tracking-tight text-gray-900',
  pageDesc: 'mt-1 max-w-2xl text-sm leading-6 text-gray-600',
  /** Space between page header and first block of content */
  contentTop: 'mt-8',
  panel: 'rounded-xl border border-gray-200 bg-white shadow-sm',
  panelPadded: 'rounded-xl border border-gray-200 bg-white p-5 shadow-sm',
  panelPaddedLg: 'rounded-xl border border-gray-200 bg-white p-6 shadow-sm',
  tableWrap: 'overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm',
  thead: 'border-b border-gray-200 bg-gray-50 text-xs font-medium uppercase tracking-wide text-gray-600',
  loading: 'text-sm text-gray-500',
  error: 'text-sm text-red-600',
  textLink: 'text-sm font-medium text-gray-900 hover:underline',
  muted: 'text-sm text-gray-500',
  /** Primary CTA — matches landlord/account actions */
  btnPrimary:
    'inline-flex items-center justify-center rounded-lg gradient-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50',
  btnSecondary:
    'rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40',
  btnChip:
    'rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-40',
  btnSuccess:
    'rounded-lg gradient-primary px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:opacity-50',
  btnWarning:
    'rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:opacity-50',
  inputSearch:
    'w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-10 pr-3 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm transition focus:border-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-200',
  tabsBar: 'flex gap-1 border-b border-gray-200',
  tab(active: boolean) {
    return [
      'border-b-2 -mb-px px-4 py-2.5 text-sm font-medium transition-colors',
      active
        ? 'border-gray-900 text-gray-900'
        : 'border-transparent text-gray-500 hover:border-gray-200 hover:text-gray-800',
    ].join(' ')
  },
  listScroll: 'max-h-[480px] divide-y divide-gray-100 overflow-y-auto',
  listItemBtn: 'w-full px-4 py-3 text-left transition hover:bg-gray-50',
  listItemBtnSelected: 'bg-gray-50',
  detailTitle: 'text-lg font-semibold tracking-tight text-gray-900',
  fieldLabel: 'text-xs font-medium uppercase tracking-wide text-gray-500',
  emptyState: 'rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-8 text-center text-sm text-gray-500',
  metricHighlight: 'border-amber-200 bg-amber-50',
  metricDefault: 'border-gray-200 bg-white',
  metricTitle: 'text-sm font-medium text-gray-600',
  metricValue: 'mt-2 text-3xl font-semibold tabular-nums tracking-tight text-gray-900',
}

export function AdminPageHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header>
      <h1 className={admin.pageTitle}>{title}</h1>
      {description ? <p className={admin.pageDesc}>{description}</p> : null}
    </header>
  )
}

export function AdminSearchInput({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div className="relative max-w-md flex-1">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={admin.inputSearch}
        autoComplete="off"
      />
    </div>
  )
}

export function AdminLoadingBlock({ className = '' }: { className?: string }) {
  return <p className={`${admin.loading} ${className}`.trim()}>Loading…</p>
}

export function AdminErrorBlock({ message, className = '' }: { message: string; className?: string }) {
  return <p className={`${admin.error} ${className}`.trim()}>{message}</p>
}
