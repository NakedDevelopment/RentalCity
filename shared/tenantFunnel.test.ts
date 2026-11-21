import assert from 'node:assert/strict'
import { test } from 'node:test'
import { aggregateTenantFunnel, recordTenantFunnelStep, type FunnelEventInsert } from './tenantFunnel'

test('recordTenantFunnelStep inserts only step, user type, and one id', async () => {
  const seen: FunnelEventInsert[] = []
  const ok = await recordTenantFunnelStep(
    'signup_account',
    { userId: null, anonymousId: 'anon-1' },
    async (row) => {
      seen.push(row)
      return { error: null }
    },
  )
  assert.equal(ok, true)
  assert.deepEqual(seen, [
    { step: 'signup_account', user_type: 'tenant', user_id: null, anonymous_id: 'anon-1' },
  ])
  assert.deepEqual(Object.keys(seen[0]).sort(), ['anonymous_id', 'step', 'user_id', 'user_type'])
})

test('recordTenantFunnelStep prefers the internal user id and drops the anonymous id', async () => {
  let row: FunnelEventInsert | null = null
  const ok = await recordTenantFunnelStep(
    ' rental_needs ',
    { userId: ' user-1 ', anonymousId: 'anon-1' },
    async (next) => {
      row = next
      return { error: null }
    },
  )
  assert.equal(ok, true)
  assert.deepEqual(row, {
    step: 'rental_needs',
    user_type: 'tenant',
    user_id: 'user-1',
    anonymous_id: null,
  })
})

test('recordTenantFunnelStep returns false when the insert reports an error', async () => {
  const ok = await recordTenantFunnelStep('signup_role', { anonymousId: 'anon-1' }, async () => ({
    error: { message: 'permission denied' },
  }))
  assert.equal(ok, false)
})

test('recordTenantFunnelStep does not throw when the insert rejects', async () => {
  const ok = await recordTenantFunnelStep('signup_role', { anonymousId: 'anon-1' }, async () => {
    throw new Error('network down')
  })
  assert.equal(ok, false)
})

test('recordTenantFunnelStep does not throw when the insert returns a broken result', async () => {
  const ok = await recordTenantFunnelStep(
    'signup_role',
    { anonymousId: 'anon-1' },
    async () => {
      throw new TypeError('cannot read error')
    },
  )
  assert.equal(ok, false)
})

test('recordTenantFunnelStep refuses empty identity, unknown steps, and oversized ids', async () => {
  let calls = 0
  const insert = async () => {
    calls += 1
    return { error: null }
  }
  assert.equal(await recordTenantFunnelStep('signup_role', {}, insert), false)
  assert.equal(await recordTenantFunnelStep('not_a_step', { anonymousId: 'anon-1' }, insert), false)
  assert.equal(await recordTenantFunnelStep('signup_role', { anonymousId: 'x'.repeat(65) }, insert), false)
  assert.equal(calls, 0)
})

test('aggregateTenantFunnel counts distinct tenants and where they stop', () => {
  const stats = aggregateTenantFunnel([
    { step: 'signup_role', user_id: null, anonymous_id: 'a' },
    { step: 'signup_role', user_id: null, anonymous_id: 'a' },
    { step: 'signup_account', user_id: null, anonymous_id: 'a' },
    { step: 'signup_role', user_id: 'user-b', anonymous_id: null },
    { step: 'signup_account', user_id: 'user-b', anonymous_id: null },
    { step: 'rental_needs', user_id: 'user-b', anonymous_id: null },
    { step: 'signup_role', user_id: 'user-c', anonymous_id: 'ignored-because-user-id-wins' },
    { step: 'application_complete', user_id: 'user-c', anonymous_id: null },
    { step: 'signup_role', user_id: null, anonymous_id: null },
    { step: 'not_a_step', user_id: 'user-b', anonymous_id: null },
  ])

  const byId = Object.fromEntries(stats.map((step) => [step.id, step]))
  assert.equal(stats.length, 16)
  assert.equal(byId.signup_role.reached, 3)
  assert.equal(byId.signup_role.stopped, 0)
  assert.equal(byId.signup_account.reached, 2)
  assert.equal(byId.signup_account.stopped, 1)
  assert.equal(byId.rental_needs.reached, 1)
  assert.equal(byId.rental_needs.stopped, 1)
  assert.equal(byId.application_complete.reached, 1)
  assert.equal(byId.application_complete.stopped, 1)
  assert.equal(stats.reduce((sum, step) => sum + step.stopped, 0), 3)
  assert.equal(stats.filter((step) => step.group === 'Application').length, 7)
})
