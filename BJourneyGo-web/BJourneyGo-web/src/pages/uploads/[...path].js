export const prerender = false

const API_URL = process.env.API_URL || 'http://localhost:4000'

function normalizePath(input) {
  if (!input) return ''
  const value = Array.isArray(input) ? input.join('/') : String(input)
  return value.replace(/^\/+/, '')
}

export async function GET({ params }) {
  try {
    const filePath = normalizePath(params?.path)
    if (!filePath) {
      return new Response('Not found', { status: 404 })
    }

    const upstream = await fetch(`${API_URL}/uploads/${filePath}`)
    if (!upstream.ok) {
      return new Response('Not found', { status: upstream.status })
    }

    const headers = new Headers()
    const contentType = upstream.headers.get('content-type')
    const contentDisposition = upstream.headers.get('content-disposition')
    const contentLength = upstream.headers.get('content-length')
    const cacheControl = upstream.headers.get('cache-control')

    if (contentType) headers.set('Content-Type', contentType)
    if (contentDisposition) headers.set('Content-Disposition', contentDisposition)
    if (contentLength) headers.set('Content-Length', contentLength)
    if (cacheControl) headers.set('Cache-Control', cacheControl)

    return new Response(upstream.body, { status: 200, headers })
  } catch (_e) {
    return new Response('Proxy error', { status: 502 })
  }
}
