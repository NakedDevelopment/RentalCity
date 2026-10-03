import assert from 'node:assert/strict'
import test from 'node:test'
import { createRecoverySessionTracker } from './recoverySession'

const session = { user: { id: 'recovery-user' } }

test('recovery validated before React mounts is still available to the reset form', () => {
  const tracker = createRecoverySessionTracker()
  tracker.record('PASSWORD_RECOVERY', session)
  tracker.record('INITIAL_SESSION', session)
  assert.equal(tracker.isRecovery(session), true)
})

test('an ordinary stored or signed-in session never authorizes recovery', () => {
  const tracker = createRecoverySessionTracker()
  tracker.record('INITIAL_SESSION', session)
  assert.equal(tracker.isRecovery(session), false)
  tracker.record('SIGNED_IN', session)
  assert.equal(tracker.isRecovery(session), false)
})

test('recovery must have a validated session for the same user', () => {
  const tracker = createRecoverySessionTracker()
  tracker.record('PASSWORD_RECOVERY', null)
  assert.equal(tracker.isRecovery(session), false)
  tracker.record('PASSWORD_RECOVERY', session)
  assert.equal(tracker.isRecovery({ user: { id: 'different-user' } }), false)
  assert.equal(tracker.isRecovery(null), false)
})

test('refreshing the recovery session retains the validated recovery state', () => {
  const tracker = createRecoverySessionTracker()
  tracker.record('PASSWORD_RECOVERY', session)
  tracker.record('TOKEN_REFRESHED', session)
  assert.equal(tracker.isRecovery(session), true)
})

test('sign-out, a normal login, or a completed update ends the recovery state', () => {
  for (const event of ['SIGNED_OUT', 'SIGNED_IN', 'USER_UPDATED']) {
    const tracker = createRecoverySessionTracker()
    tracker.record('PASSWORD_RECOVERY', session)
    tracker.record(event, session)
    assert.equal(tracker.isRecovery(session), false)
  }
})