import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js'
import { getStripe } from '../lib/stripe'

type StripeCheckoutModalProps = {
  open: boolean
  onClose: () => void
  /**
   * Called once when the modal opens. Should create a Checkout Session on the
   * server (with `ui_mode: 'embedded'`) and resolve with its `client_secret`.
   */
  fetchClientSecret: () => Promise<string>
  title?: string
}

export default function StripeCheckoutModal({
  open,
  onClose,
  fetchClientSecret,
  title = 'Complete your payment',
}: StripeCheckoutModalProps) {
  if (!open) return null

  const stripePromise = getStripe()

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 px-4 py-8"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="w-full max-w-[520px] rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-medium text-gray-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="px-3 py-4 sm:px-4">
          <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      </div>
    </div>
  )
}
