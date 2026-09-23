/** Resolve the public origin of the browser that started an embedded ceremony. */
export function docusignReturnOrigin(
  requestOrigin: string | undefined,
  fetchSite: string | undefined,
  configuredFallback: string,
  production: boolean,
): string {
  if (requestOrigin && fetchSite !== 'cross-site') {
    try {
      const url = new URL(requestOrigin)
      if (url.origin === requestOrigin && (url.protocol === 'https:' ||
          (!production && url.protocol === 'http:' &&
            ['localhost', '127.0.0.1'].includes(url.hostname)))) return url.origin
    } catch {
      // Fall through to the configured public URL.
    }
  }
  const url = new URL(configuredFallback)
  if (url.protocol === 'https:' || (!production && url.protocol === 'http:' &&
      ['localhost', '127.0.0.1'].includes(url.hostname))) return url.origin
  throw new Error('No public DocuSign return URL is available for this request')
}