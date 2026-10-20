export type TenantChoiceId = string

export type TenantChoice = {
  id: TenantChoiceId
  label: string
  score: number // 1–10 per spec
}

export type TenantQuestionId = string

export type TenantQuestion = {
  id: TenantQuestionId
  text: string
  helperText?: string
  type: 'single'
  choices: TenantChoice[]
  /** When set, this question is only shown if the referenced question's answer equals the given choice id. */
  showIf?: { questionId: TenantQuestionId; equals: TenantChoiceId }
}

// Full tenant questionnaire + scores from scoring doc
// Tenant score 10–100 will be derived from these line‑item scores.
export const tenantQuestions: TenantQuestion[] = [
  {
    id: 'previous_landlord_duration',
    text: 'How long were you at your previous landlord?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 year or less', score: 1 },
      { id: 'b', label: '1–2 years', score: 4 },
      { id: 'c', label: '2–4 years', score: 8 },
      { id: 'd', label: '4 or more years', score: 10 },
    ],
  },
  {
    id: 'employment_duration',
    text: 'How long have you been employed?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 year', score: 1 },
      { id: 'b', label: '2 years', score: 4 },
      { id: 'c', label: '3 years', score: 8 },
      { id: 'd', label: '4 years or more', score: 10 },
    ],
  },
  {
    id: 'late_fees_last_two_years',
    text: 'How many late fees have you had in the last 2 years?',
    type: 'single',
    choices: [
      { id: 'a', label: '1', score: 7 },
      { id: 'b', label: '2', score: 5 },
      { id: 'c', label: '3', score: 3 },
      { id: 'd', label: '4 or more', score: 1 },
      { id: 'e', label: '0 (never had a late fee)', score: 10 },
    ],
  },
  {
    id: 'twenty_four_hour_notice',
    text: 'Would you give permission to your landlord or their management company to enter your home with a 24‑hour notice?',
    type: 'single',
    choices: [
      { id: 'a', label: 'Yes', score: 10 },
      { id: 'b', label: 'No', score: 7 },
    ],
  },
  {
    id: 'household_size',
    text: 'How many people will be living with you?',
    helperText: 'This will help determine how many rooms are needed for your family size. Questions 6 and 7 go together.',
    type: 'single',
    choices: [
      { id: 'a', label: '2', score: 0 }, // score is computed via Q5+Q6 rule
      { id: 'b', label: '3', score: 0 },
      { id: 'c', label: '4', score: 0 },
      { id: 'd', label: '5', score: 0 },
    ],
  },
  {
    id: 'bedrooms_needed',
    text: 'How many bedrooms are you needing?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 room', score: 0 }, // score is computed via Q5+Q6 rule
      { id: 'b', label: '2 rooms', score: 0 },
      { id: 'c', label: '3 rooms', score: 0 },
      { id: 'd', label: '4 rooms or more', score: 0 },
    ],
  },
  {
    id: 'rental_budget',
    text: 'What is your rental budget?',
    helperText: 'Monthly rent will be compared to your total monthly income.',
    type: 'single',
    choices: [
      { id: 'a', label: '$1,200 or less', score: 0 }, // actual score comes from rent‑to‑income ratio
      { id: 'b', label: '$1,201–$1,450', score: 0 },
      { id: 'c', label: '$1,451–$1,700', score: 0 },
      { id: 'd', label: '$1,701–$2,000', score: 0 },
      { id: 'e', label: '$2,001–$2,500', score: 0 },
      { id: 'f', label: '$2,501 or more', score: 0 },
    ],
  },
  {
    id: 'emergency_funds',
    text: 'If your rent is $1,500, and you had $2,000 in the bank, and you had a car repair for $800, what would you do?',
    type: 'single',
    choices: [
      { id: 'a', label: 'I would pay my rent on time.', score: 10 },
      {
        id: 'b',
        label: 'I would call my landlord to let them know I might be late and when I will pay.',
        score: 7,
      },
      { id: 'c', label: 'I would fix my car and pay next month.', score: 1 },
      { id: 'd', label: 'I keep emergency funds available.', score: 10 },
    ],
  },
  {
    id: 'eviction_history',
    text: 'Have you ever been evicted from your home?',
    type: 'single',
    choices: [
      { id: 'a', label: 'In the last 12 months', score: 1 },
      { id: 'b', label: 'In the last 24 months', score: 3 },
      { id: 'c', label: 'In the last 36 months', score: 7 },
      { id: 'd', label: 'In the last 48 months', score: 8 },
      { id: 'e', label: 'I have never been evicted', score: 10 },
    ],
  },
  {
    id: 'late_frequency_reported',
    text: 'If we were to call your last landlord and ask them how often you were late, what would they say?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 time a year', score: 8 },
      { id: 'b', label: '2 times a year', score: 6 },
      { id: 'c', label: '3 times a year', score: 3 },
      { id: 'd', label: 'Never', score: 10 },
    ],
  },
  {
    id: 'rental_insurance_acceptance',
    text: 'Would you rent from someone who requires rental insurance?',
    type: 'single',
    choices: [
      { id: 'a', label: 'Yes', score: 10 },
      { id: 'b', label: 'No', score: 5 },
    ],
  },
  {
    id: 'bankruptcy_history',
    text: 'Have you filed bankruptcy?',
    type: 'single',
    choices: [
      { id: 'a', label: 'In the last 12 months', score: 1 },
      { id: 'b', label: 'In the last 24 months', score: 4 },
      { id: 'c', label: 'In the last 36 months', score: 6 },
      { id: 'd', label: 'In the last 48 months', score: 8 },
      { id: 'e', label: 'I have never filed bankruptcy', score: 10 },
    ],
  },
  {
    id: 'conflict_reaction',
    text: 'If your landlord or management company is overtalking and being rude, how would you react?',
    type: 'single',
    choices: [
      { id: 'a', label: 'I would let it roll off my shoulders.', score: 10 },
      { id: 'b', label: 'I will be looking for a new home as soon as my lease is up.', score: 8 },
      { id: 'c', label: 'I would give them back the same energy.', score: 3 },
      { id: 'd', label: 'I would pack up and leave because I shouldn’t be disrespected.', score: 2 },
    ],
  },
  {
    id: 'participates_in_voucher_program',
    text: 'Do you participate in a housing voucher program?',
    type: 'single',
    choices: [
      { id: 'yes', label: 'Yes', score: 0 },
      { id: 'no', label: 'No', score: 0 },
    ],
  },
  {
    id: 'voucher_coverage_percentage',
    text: 'What percentage of your rent does it cover?',
    type: 'single',
    showIf: { questionId: 'participates_in_voucher_program', equals: 'yes' },
    choices: [
      { id: '25', label: '25%', score: 0 },
      { id: '50', label: '50%', score: 0 },
      { id: '75', label: '75%', score: 0 },
      { id: '100', label: '100%', score: 0 },
    ],
  },
]

/** Resolve stored answer id to human-readable label (tenant profile, landlord applicant view, etc.). */
export function getTenantQuestionnaireChoiceLabel(
  questionId: string,
  choiceId: string | null | undefined,
): string | null {
  if (!choiceId || typeof choiceId !== 'string') return null
  const q = tenantQuestions.find((x) => x.id === questionId)
  const choice = q?.choices.find((c) => c.id === choiceId)
  return choice?.label ?? null
}

