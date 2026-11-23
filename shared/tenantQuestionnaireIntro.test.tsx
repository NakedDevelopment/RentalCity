import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { TenantQuestionnaireIntro } from '../client/src/components/TenantQuestionnaireIntro'
import {
  FIRST_QUESTIONNAIRE_STEP,
  entryAfterStartSurvey,
  questionnaireEntry,
} from './tenantQuestionnaireIntro'

const fresh = { answers: null, bio: null }

test('a new tenant sees the explainer and the only action opens the first step', () => {
  const entry = questionnaireEntry(fresh)
  assert.deepEqual(entry, { screen: 'intro' })
  assert.deepEqual(questionnaireEntry({ answers: {}, bio: '   ' }), { screen: 'intro' })
  assert.deepEqual(questionnaireEntry({ answers: { rental_budget: null, monthly_income: '' }, bio: null }), {
    screen: 'intro',
  })

  const html = renderToStaticMarkup(createElement(TenantQuestionnaireIntro, { onStart: () => {} }))
  assert.match(html, /Before your questionnaire/)
  assert.match(html, /Find the landlord/)
  assert.match(html, /who&#x27;s right for you\.|who's right for you\./)
  assert.match(html, /This quick survey helps us match you with the best landlord for you\./)
  assert.match(html, /Better matches/)
  assert.match(html, /Takes a few minutes/)
  assert.match(html, /Stand out to landlords/)
  assert.match(html, /Start the Survey/)
  assert.equal((html.match(/<button/g) ?? []).length, 1)
  assert.equal((html.match(/<a[\s>]/g) ?? []).length, 0)
  assert.doesNotMatch(html, /\$|fee|payment|price/i)

  const next = entryAfterStartSurvey()
  assert.deepEqual(next, { screen: 'questions', step: FIRST_QUESTIONNAIRE_STEP })
  assert.equal(next.step, 1)
})

test('a tenant with saved progress skips the explainer and stays on the existing first step', () => {
  assert.deepEqual(questionnaireEntry({ answers: { previous_landlord_duration: 'b' }, bio: null }), {
    screen: 'questions',
    step: FIRST_QUESTIONNAIRE_STEP,
  })
  assert.deepEqual(questionnaireEntry({ answers: { monthly_income: 4200 }, bio: '' }), {
    screen: 'questions',
    step: FIRST_QUESTIONNAIRE_STEP,
  })
  assert.deepEqual(questionnaireEntry({ answers: null, bio: 'I work from home.' }), {
    screen: 'questions',
    step: FIRST_QUESTIONNAIRE_STEP,
  })
})
