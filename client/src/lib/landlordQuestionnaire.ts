export type LandlordChoiceId = string

export type LandlordChoice = {
  id: LandlordChoiceId
  label: string
  /** In a multi-select question, selecting this clears all other choices (and vice versa). */
  exclusive?: boolean
}

export type LandlordQuestionId = string

export type LandlordQuestion = {
  id: LandlordQuestionId
  text: string
  helperText?: string
  type: 'single' | 'multi'
  choices: LandlordChoice[]
}

// Landlord questionnaire – no scoring yet; this just captures preferences.
export const landlordQuestions: LandlordQuestion[] = [
  {
    id: 'management_style',
    text: 'Do you manage your homes, or do you have a management company?',
    type: 'single',
    choices: [
      { id: 'a', label: 'Self‑manage' },
      { id: 'b', label: 'Management company' },
    ],
  },
  {
    id: 'ownership_duration',
    text: 'How long have you owned rental property?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 year or less' },
      { id: 'b', label: '1 year to 2 years' },
      { id: 'c', label: '2 years to 3 years' },
      { id: 'd', label: '4 years or more' },
    ],
  },
  {
    id: 'criminal_record_policy',
    text: 'Would you rent to a person who has a criminal record? If yes, which offenses would you allow?',
    helperText: 'Select all that you would consider.',
    type: 'multi',
    choices: [
      { id: 'a', label: 'Someone who stole under $1,000' },
      { id: 'b', label: 'Someone who has a DUI or was caught with drug possession' },
      { id: 'c', label: 'Domestic violence' },
      { id: 'd', label: 'Fraud' },
      { id: 'none', label: "No, we don't rent to someone with a criminal record", exclusive: true },
    ],
  },
  {
    id: 'thirty_percent_rule',
    text: 'Do you use 30% of the tenant’s gross income to determine monthly rent payment?',
    type: 'single',
    choices: [
      { id: 'a', label: 'Yes' },
      { id: 'b', label: 'No' },
    ],
  },
  {
    id: 'eviction_policy',
    text: 'Would you rent to someone with an eviction on their record? If yes, which cases would you accept?',
    helperText: 'Select all that you would consider.',
    type: 'multi',
    choices: [
      { id: 'a', label: '1 eviction in the last 12 months' },
      { id: 'b', label: '1 eviction in the last 24 months' },
      { id: 'c', label: '1 eviction in the last 36 months' },
      { id: 'd', label: '1 eviction in the last 48 months' },
      { id: 'e', label: 'All of the above' },
    ],
  },
  {
    id: 'require_rental_insurance',
    text: 'Do you require rental insurance?',
    type: 'single',
    choices: [
      { id: 'a', label: 'Yes' },
      { id: 'b', label: 'No' },
    ],
  },
  {
    id: 'maintenance_frequency',
    text: 'How often do you perform maintenance checks?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 time a year' },
      { id: 'b', label: '2 times a year' },
      { id: 'c', label: '1 time every 24 months' },
      { id: 'd', label: 'Never (only if I hear from the tenant)' },
    ],
  },
  {
    id: 'average_tenant_stay',
    text: 'How long does your average tenant stay in your home?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 year' },
      { id: 'b', label: '2 years' },
      { id: 'c', label: '3 years' },
      { id: 'd', label: '4 years or more' },
    ],
  },
  {
    id: 'bankruptcy_policy',
    text: 'Will you rent to a tenant who has filed bankruptcy? If yes, which cases would you accept?',
    helperText: 'Select all that you would consider.',
    type: 'multi',
    choices: [
      { id: 'a', label: 'In the last 12 months' },
      { id: 'b', label: 'In the last 24 months' },
      { id: 'c', label: 'In the last 36 months' },
      { id: 'd', label: 'In the last 48 months' },
      { id: 'e', label: 'All of the above' },
    ],
  },
  {
    id: 'employment_history_requirement',
    text: 'If you reviewed the tenant’s work history, what is the shortest period on the job you would require?',
    type: 'single',
    choices: [
      { id: 'a', label: '1 year' },
      { id: 'b', label: '2 years' },
      { id: 'c', label: '3 years' },
      { id: 'd', label: '4 years or more' },
    ],
  },
  {
    id: 'late_payment_policy',
    text: 'Would you rent to someone who has late rental payments in the past 2 years?',
    helperText: 'If yes, which late‑fee history would you accept?',
    type: 'multi',
    choices: [
      { id: 'a', label: '1 late fee' },
      { id: 'b', label: '2 late fees' },
      { id: 'c', label: '3 late fees' },
      { id: 'd', label: '4 or more late fees' },
      { id: 'e', label: 'All of the above' },
    ],
  },
  {
    id: 'conflict_handling_style',
    text: 'How would you handle a situation where a tenant yells because you can’t get there soon enough to fix a problem?',
    type: 'single',
    choices: [
      { id: 'a', label: 'I would understand how they feel.' },
      { id: 'b', label: 'I would hang the phone up and deal with them later.' },
      { id: 'c', label: 'I would calm them down and try to speak to them.' },
      { id: 'd', label: 'I would yell at them to show them I’m not scared of them.' },
    ],
  },
]

