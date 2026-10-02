import assert from 'node:assert/strict'
import test from 'node:test'
import { publicAppUrl, propertyInviteUrl, DEFAULT_PUBLIC_APP_URL } from './publicAppUrl'
import { buildLandlordLifecycleEmail } from '../server/email'

test('unconfigured public links use the customer-facing site, never localhost', () => {
  assert.equal(publicAppUrl(), DEFAULT_PUBLIC_APP_URL)
  assert.equal(publicAppUrl('  '), DEFAULT_PUBLIC_APP_URL)
  assert.equal(propertyInviteUrl('example-token'), `${DEFAULT_PUBLIC_APP_URL}/invite/example-token`)
})

test('a public configured origin is normalized', () => {
  assert.equal(publicAppUrl(' https://app.gorentalcity.com/ '), DEFAULT_PUBLIC_APP_URL)
  assert.equal(publicAppUrl('https://public.example.com/'), 'https://public.example.com')
})

test('unsafe or malformed configured URLs fail explicitly', () => {
  for (const value of [
    'http://localhost:5000', 'https://localhost:5000', 'https://127.0.0.1',
    'https://0.0.0.0', 'https://[::1]', 'https://preview.localhost',
    'https://preview.local', 'https://app.internal', 'not-a-url',
    'http://app.gorentalcity.com', 'https://user:password@example.com',
    'https://app.gorentalcity.com/properties', 'https://app.gorentalcity.com/?next=bad',
  ]) {
    assert.throws(() => publicAppUrl(value), /public HTTPS origin/)
  }
})

test('every landlord lifecycle email points to a public app URL', () => {
  const paths = {
    all_uploaded: '/properties',
    partial_upload: '/onboarding/property/basic-info',
    upload_reminder: '/onboarding/property/intro',
  } as const
  for (const kind of Object.keys(paths) as Array<keyof typeof paths>) {
    const { html } = buildLandlordLifecycleEmail(kind, { firstName: 'Test', appUrl: publicAppUrl() })
    assert.ok(html.includes(`href="${DEFAULT_PUBLIC_APP_URL}${paths[kind]}"`))
    assert.ok(!html.includes('localhost'))
  }
})