const SECURITY_HEADERS = {
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Content-Type-Options': 'nosniff'
}

export default {
  async fetch(request, env) {
    if (!['GET', 'HEAD'].includes(request.method)) {
      return new Response('Method not allowed', {
        status: 405,
        headers: { Allow: 'GET, HEAD', ...SECURITY_HEADERS }
      })
    }

    const assetResponse = await env.ASSETS.fetch(request)
    if (assetResponse.status !== 404) return withSecurityHeaders(assetResponse)

    const acceptsHtml = request.headers.get('accept')?.includes('text/html')
    if (!acceptsHtml) return withSecurityHeaders(assetResponse)

    const indexUrl = new URL('/index.html', request.url)
    const indexRequest = new Request(indexUrl, {
      method: request.method,
      headers: request.headers
    })
    const indexResponse = await env.ASSETS.fetch(indexRequest)
    return withSecurityHeaders(indexResponse, { 'Cache-Control': 'no-cache' })
  }
}

function withSecurityHeaders(response, extraHeaders = {}) {
  const headers = new Headers(response.headers)
  Object.entries({ ...SECURITY_HEADERS, ...extraHeaders }).forEach(([name, value]) => {
    headers.set(name, value)
  })
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}
