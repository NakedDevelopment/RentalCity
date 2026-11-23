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

/** The only action on the explainer opens the first questionnaire step. */
export function entryAfterStartSurvey(): Extract<QuestionnaireEntry, { screen: 'questions' }> {
  return { screen: 'questions', step: FIRST_QUESTIONNAIRE_STEP }
}
