export const TENANT_REVIEWS_CARD_TITLE = 'Reviews from landlords'

/** Max reviews shown on tenant account and landlord tenant profile before “View all”. */
export const TENANT_LANDLORD_REVIEWS_PREVIEW_COUNT = 2

/** Primary Edit / Write review actions (matches account section Edit + full reviews page). */
export const TENANT_REVIEW_PRIMARY_BUTTON_CLASSNAME =
  'rounded-lg gradient-primary px-5 py-3 text-sm font-medium text-white disabled:opacity-60'

/** Shown on tenant Account and anywhere we describe the same data to tenants. */
export const TENANT_REVIEWS_DESCRIPTION_AS_TENANT =
  'Landlords can leave ratings and comments about your rental history. You can’t edit reviews written by landlords.'

/** Shown when a landlord views a tenant’s profile or full reviews list. */
export const TENANT_REVIEWS_DESCRIPTION_AS_LANDLORD =
  'Landlords can leave ratings and comments about this tenant. You can add or edit only your own review; other landlords’ reviews are read-only.'

export function formatTenantReviewDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function ReviewStarsReadOnly({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }).map((_, index) => (
        <svg
          key={index}
          className={`h-4 w-4 ${index < value ? 'text-gray-500' : 'text-gray-200'}`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.036 3.19a1 1 0 00.95.69h3.354c.969 0 1.371 1.24.588 1.81l-2.714 1.972a1 1 0 00-.364 1.118l1.036 3.19c.3.921-.755 1.688-1.539 1.118l-2.714-1.972a1 1 0 00-1.176 0l-2.714 1.972c-.783.57-1.838-.197-1.539-1.118l1.036-3.19a1 1 0 00-.364-1.118L2.17 8.617c-.783-.57-.38-1.81.588-1.81h3.354a1 1 0 00.95-.69l1.036-3.19z" />
        </svg>
      ))}
    </div>
  )
}

type TenantReviewListRowContentProps = {
  authorLabel: string
  createdAtIso: string
  rating: number
  propertyName: string | null
  propertyAddress: string | null
  comment: string | null
}

export function TenantReviewListRowContent({
  authorLabel,
  createdAtIso,
  rating,
  propertyName,
  propertyAddress,
  comment,
}: TenantReviewListRowContentProps) {
  const when = formatTenantReviewDate(createdAtIso)
  const ctx = propertyName?.trim() || propertyAddress?.trim() || null
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="text-sm font-semibold text-gray-900">{authorLabel}</p>
        <span className="text-xs text-gray-500">{when}</span>
      </div>
      <div className="mt-2">
        <ReviewStarsReadOnly value={rating} />
      </div>
      {ctx ? <p className="mt-1 text-xs text-gray-500">{ctx}</p> : null}
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
        {comment?.trim() || 'No written comment.'}
      </p>
    </>
  )
}
