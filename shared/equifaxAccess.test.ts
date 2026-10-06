import assert from 'node:assert/strict'
import test from 'node:test'
import { hasEquifaxCreditAccess, hasSignedCurrentEquifaxApplication } from './equifaxAccess'

test('signing alone never grants a new applicant credit access', () => {
  const signed = { equifax_agreement_version: 3, docusign_envelope_status: 'completed' }
  assert.equal(hasSignedCurrentEquifaxApplication(signed), true)
  assert.equal(hasEquifaxCreditAccess(signed), false)
})

test('new approvals require the whole current application signed', () => {
  const approved = { equifax_approved_at: '2026-10-06', equifax_approved_version: 3 }
  assert.equal(hasEquifaxCreditAccess({ ...approved, equifax_agreement_version: 2, docusign_envelope_status: 'completed' }), false)
  assert.equal(hasEquifaxCreditAccess({ ...approved, equifax_agreement_version: 3, docusign_envelope_status: 'sent' }), false)
  assert.equal(hasEquifaxCreditAccess({ ...approved, equifax_agreement_version: 3, docusign_envelope_status: 'completed' }), true)
})

test('prior approved landlords retain access until explicit revocation during re-signing', () => {
  const approved = { equifax_approved_at: '2026-09-23', equifax_approved_version: 2 }
  for (const [version, status] of [[2, 'completed'], [3, 'sent'], [3, 'completed']] as const) {
    assert.equal(hasEquifaxCreditAccess({ ...approved, equifax_agreement_version: version, docusign_envelope_status: status }), true)
  }
  assert.equal(hasEquifaxCreditAccess({ ...approved, equifax_approved_at: null }), false)
})
