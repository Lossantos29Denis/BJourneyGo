const API_URL = process.env.API_URL || 'http://localhost:4000'

function normalizePath(input) {
  if (!input) return ''
  const value = Array.isArray(input) ? input.join('/') : String(input)
  return value.replace(/^\/+/, '')
}

export async function GET({ params }) {
  try {
    const path = normalizePath(params?.path)
    if (!path) {
      return new Response(JSON.stringify({ error: 'invalid path' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    const upstream = await fetch(`${API_URL}/uploads/${path}`)
    if (!upstream.ok) {
      const text = await upstream.text().catch(() => '')
      return new Response(text || JSON.stringify({ error: 'file not found' }), {
        status: upstream.status,
        headers: { 'Content-Type': upstream.headers.get('content-type') || 'application/json' }
      })
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
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
