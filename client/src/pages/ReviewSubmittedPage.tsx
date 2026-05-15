import { Link, useParams } from 'react-router-dom'

const REVIEW_SUMMARY: Record<
  string,
  {
    landlordName: string
    propertyTitle: string
    rating: number
  }
> = {
  '1': {
    landlordName: 'Michael Chen',
    propertyTitle: '123 Mission Street, Apt 4B',
    rating: 4,
  },
  '2': {
    landlordName: 'Emma Rodriguez',
    propertyTitle: '456 Valencia Avenue, Unit 2A',
    rating: 4,
  },
  '3': {
    landlordName: 'David Park',
    propertyTitle: '789 Castro Street, Studio',
    rating: 4,
  },
}

const nextSteps = [
  'Your rating has been recorded and will help improve our matching algorithm',
  'Continue browsing new property matches on your dashboard',
  'Update your profile preferences to find better matches',
]

export function ReviewSubmittedPage() {
  const { id = '3' } = useParams()
  const review = REVIEW_SUMMARY[id] ?? REVIEW_SUMMARY['3']

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-200 bg-white px-8 py-10 shadow-sm">
        <div className="flex justify-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-700">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>

        <h1 className="mt-5 text-center text-[2rem] font-medium text-gray-900">Thank You</h1>
        <p className="mx-auto mt-3 max-w-[350px] text-center text-sm leading-7 text-gray-600">
          Your feedback helps us improve the experience for everyone. Your review won&apos;t be publicly visible.
        </p>

        <div className="mt-7 rounded-lg bg-gray-50 px-5 py-5">
          <div className="flex items-center justify-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-gray-700 shadow-sm">
              <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 12c2.761 0 5-2.686 5-6S14.761 0 12 0 7 2.686 7 6s2.239 6 5 6zm0 2c-4.418 0-8 2.686-8 6v2h16v-2c0-3.314-3.582-6-8-6z" />
              </svg>
            </div>

            <div>
              <p className="text-[1.1rem] font-medium text-gray-900">{review.landlordName}</p>
              <p className="text-sm text-gray-600">{review.propertyTitle}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center gap-1 text-base">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={index} className={index < review.rating ? 'text-gray-800' : 'text-gray-300'}>
                      ★
                    </span>
                  ))}
                </div>
              </div>
              <p className="mt-1 text-sm text-gray-600">{review.rating} out of 5 stars</p>
            </div>
          </div>
        </div>

        <Link
          to="/account"
          className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg btn-primary py-3 text-sm font-medium text-white"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Profile
        </Link>
      </div>

      <div className="mt-10">
        <h2 className="text-[1.35rem] font-medium text-gray-900">What&apos;s Next?</h2>
        <div className="mt-4 space-y-3">
          {nextSteps.map((step) => (
            <div key={step} className="flex items-start gap-2.5 text-sm text-gray-600">
              <span className="mt-1 flex h-4 w-4 items-center justify-center rounded-full bg-gray-400 text-white">
                <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
