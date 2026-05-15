export type VerificationStatusItem = {
  label: string
  complete: boolean
}

/** Default rows shown on tenant Account and landlord view of tenant profile. */
export const DEFAULT_TENANT_VERIFICATION_ITEMS: VerificationStatusItem[] = [
  { label: 'Identity Verified', complete: true },
  { label: 'Income Verified', complete: true },
  { label: 'References Verified', complete: true },
  { label: 'Background Check', complete: false },
]

type ChecklistProps = {
  items?: VerificationStatusItem[]
}

/**
 * Icon column + labels: green disk + white check when complete, rose disk + X when not.
 * Used inside VerificationStatusCard on tenant Account and landlord tenant profile sidebar.
 */
export function VerificationStatusChecklist({ items = DEFAULT_TENANT_VERIFICATION_ITEMS }: ChecklistProps) {
  return (
    <ul className="space-y-3.5">
      {items.map((item) => (
        <li key={item.label} className="flex items-start gap-3">
          <span
            className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
              item.complete ? 'gradient-primary text-white' : 'bg-rose-100 text-rose-600'
            }`}
            aria-hidden
          >
            {item.complete ? (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
          </span>
          <span
            className={`min-w-0 text-sm leading-6 ${
              item.complete ? 'font-medium text-gray-900' : 'font-normal text-gray-500'
            }`}
          >
            {item.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

type CardProps = {
  items?: VerificationStatusItem[]
}

/** Same chrome as tenant Account `Card` / landlord `ProfileContentCard` (title + padding). */
export function VerificationStatusCard({ items }: CardProps) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold tracking-tight text-gray-900">Verification Status</h2>
      <VerificationStatusChecklist items={items} />
    </section>
  )
}
