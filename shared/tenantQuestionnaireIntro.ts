export const FIRST_QUESTIONNAIRE_STEP = 1

export type QuestionnaireProgress = {
  answers: Record<string, unknown> | null | undefined
  bio: string | null | undefined
}

export type QuestionnaireEntry =
  | { screen: 'intro' }
  | { screen: 'questions'; step: number }

function hasAnswerValue(value: unknown): boolean {
  if (value == null) return false
  if (typeof value === 'string') return value.trim().length > 0
  return true
}

/** Saved bio or any stored questionnaire answer. Lease-preference defaults are not progress. */
export function hasSavedQuestionnaireProgress(progress: QuestionnaireProgress): boolean {
  if (progress.bio?.trim()) return true
  const answers = progress.answers
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false
  return Object.values(answers).some(hasAnswerValue)
}

/** New tenants see the explainer. Saved progress resumes the existing first step. */
export function questionnaireEntry(progress: QuestionnaireProgress): QuestionnaireEntry {
  if (hasSavedQuestionnaireProgress(progress)) {
    return { screen: 'questions', step: FIRST_QUESTIONNAIRE_STEP }
  }
  return { screen: 'intro' }
}

/** The only action on a later explainer visit opens the first questionnaire step. */
export function entryAfterStartSurvey(): Extract<QuestionnaireEntry, { screen: 'questions' }> {
  return { screen: 'questions', step: FIRST_QUESTIONNAIRE_STEP }
}

/** First screen after a new tenant account is created. Preference steps come later. */
export function newTenantOnboardingPath(): '/tenant-questionnaire' {
  return '/tenant-questionnaire'
}

/** Start the Survey on that first screen continues into the existing onboarding steps. */
export function pathAfterExplainerStart(): '/rental-needs' {
  return '/rental-needs'
}

export const EXPLAINER_GATES_ONBOARDING_KEY = 'rc_questionnaire_intro_gates_onboarding'
export const EXPLAINER_CONTINUED_KEY = 'rc_questionnaire_intro_continued'

export type ExplainerFlagStore = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export function markExplainerFirstInOnboarding(store: ExplainerFlagStore) {
  store.setItem(EXPLAINER_GATES_ONBOARDING_KEY, '1')
  store.removeItem(EXPLAINER_CONTINUED_KEY)
}

export function markExplainerContinuedToOnboarding(store: ExplainerFlagStore) {
  store.setItem(EXPLAINER_CONTINUED_KEY, '1')
  store.removeItem(EXPLAINER_GATES_ONBOARDING_KEY)
}

export function explainerGatesOnboarding(store: ExplainerFlagStore): boolean {
  return store.getItem(EXPLAINER_GATES_ONBOARDING_KEY) === '1'
}

export function explainerContinuedToOnboarding(store: ExplainerFlagStore): boolean {
  return store.getItem(EXPLAINER_CONTINUED_KEY) === '1'
}

/** Saved progress still skips the explainer. Continuing past the first screen does too. */
export function shouldShowQuestionnaireIntro(progress: QuestionnaireProgress, introContinued: boolean): boolean {
  return questionnaireEntry(progress).screen === 'intro' && !introContinued
}

export type ExplainerStartAction =
  | { type: 'onboarding'; path: '/rental-needs' }
  | { type: 'questions'; step: number }

/** The post-signup explainer continues into rental needs. Any other visit opens step 1. */
export function actionAfterExplainerStart(gatesOnboarding: boolean): ExplainerStartAction {
  if (gatesOnboarding) return { type: 'onboarding', path: pathAfterExplainerStart() }
  const next = entryAfterStartSurvey()
  return { type: 'questions', step: next.step }
}
