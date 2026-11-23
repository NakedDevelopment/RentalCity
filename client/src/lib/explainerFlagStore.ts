import type { ExplainerFlagStore } from '../../../shared/tenantQuestionnaireIntro'

/** Session flags for the post-signup explainer. Failures leave the flags unset. */
export function explainerFlagStore(): ExplainerFlagStore {
  return {
    getItem(key) {
      try {
        return sessionStorage.getItem(key)
      } catch {
        return null
      }
    },
    setItem(key, value) {
      try {
        sessionStorage.setItem(key, value)
      } catch {
        /* storage is optional */
      }
    },
    removeItem(key) {
      try {
        sessionStorage.removeItem(key)
      } catch {
        /* storage is optional */
      }
    },
  }
}
