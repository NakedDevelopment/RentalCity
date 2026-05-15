import { Link } from 'react-router-dom'

export function PaymentMethodPage() {
  return (
    <div className="space-y-6">
      <div className="mb-6">
        <div className="flex items-center gap-2 text-gray-600">
          <Link
            to="/account/settings"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-gray-100"
            aria-label="Back to settings"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-[2rem] font-medium text-gray-900">Payment Method</h1>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          Manage your payment information for match unlocks and premium features.
        </p>
      </div>

      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-[1.8rem] font-medium text-gray-900">Current Payment Method</h2>
          <button
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-lg btn-primary px-4 py-3 text-sm font-medium text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
            </svg>
            Update Payment Method
          </button>
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-white px-5 py-5">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-800 text-[10px] font-bold uppercase text-white">
              visa
            </div>
            <div>
              <p className="text-[1.05rem] font-medium text-gray-900">Visa ending in 4532</p>
              <p className="mt-1 text-sm text-gray-500">Expires 12/2027</p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:gap-3">
            <span className="font-medium text-gray-700">Billing Address:</span>
            <span className="text-gray-600">123 Main St, San Francisco, CA 94105</span>
          </div>
        </div>
      </section>
    </div>
  )
}
