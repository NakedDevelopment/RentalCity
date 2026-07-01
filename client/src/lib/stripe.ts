import { loadStripe, type Stripe } from '@stripe/stripe-js'

// Publishable keys are safe to expose to the browser. In dev the server creates
// Checkout Sessions with the TEST secret key, so the client must load the TEST
// publishable key; in production it uses the live key. We fall back to whichever
// key is present so a single configured key still works.
const publishableKey =
  (import.meta.env.PROD
    ? (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined)
    : (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST as string | undefined)) ||
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY_TEST as string | undefined) ||
  ''

export const stripeConfigured = Boolean(publishableKey)

let stripePromise: Promise<Stripe | null> | null = null

export function getStripe(): Promise<Stripe | null> {
  if (!publishableKey) {
    console.warn(
      'Missing VITE_STRIPE_PUBLISHABLE_KEY (or VITE_STRIPE_PUBLISHABLE_KEY_TEST) – Stripe checkout will not load.',
    )
    return Promise.resolve(null)
  }
  if (!stripePromise) stripePromise = loadStripe(publishableKey)
  return stripePromise
}
