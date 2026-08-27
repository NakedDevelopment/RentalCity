export type MetaEventParameters = Record<string, string | number | boolean | undefined>

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export function trackMetaEvent(eventName: string, parameters?: MetaEventParameters) {
  if (parameters) {
    window.fbq?.('track', eventName, parameters)
    return
  }
  window.fbq?.('track', eventName)
}

export function trackMetaCustomEvent(eventName: string, parameters?: MetaEventParameters) {
  if (parameters) {
    window.fbq?.('trackCustom', eventName, parameters)
    return
  }
  window.fbq?.('trackCustom', eventName)
}

export function trackMetaEventOnce(
  dedupeKey: string,
  eventName: string,
  parameters?: MetaEventParameters,
) {
  const storageKey = `meta-pixel:${dedupeKey}`
  try {
    if (window.sessionStorage.getItem(storageKey)) return
    trackMetaEvent(eventName, parameters)
    window.sessionStorage.setItem(storageKey, '1')
  } catch {
    trackMetaEvent(eventName, parameters)
  }
}