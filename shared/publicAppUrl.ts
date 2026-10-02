// The verified customer-facing site. Background emails and copied invitations
// must not use a local server, preview hostname, or an untrusted request header.
export const DEFAULT_PUBLIC_APP_URL = 'https://app.gorentalcity.com'

export function publicAppUrl(configured?: string): string {
  const value = configured?.trim() || DEFAULT_PUBLIC_APP_URL
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new Error('App URL must be a public HTTPS origin.')
  }
  const host = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:' ||
    url.username || url.password ||
    url.pathname !== '/' || url.search || url.hash ||
    !host.includes('.') ||
    /^[\d.]+$/.test(host) ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host.endsWith('.invalid')
  ) {
    throw new Error('App URL must be a public HTTPS origin, not localhost or a URL with a path.')
  }
  return url.origin
}

export function propertyInviteUrl(token: string, configured?: string): string {
  return `${publicAppUrl(configured)}/invite/${encodeURIComponent(token)}`
}