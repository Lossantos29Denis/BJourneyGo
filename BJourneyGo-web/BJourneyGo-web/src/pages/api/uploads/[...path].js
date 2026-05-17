import { forwardStream } from '../_lib/proxy.js'

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

    return forwardStream({ headers: new Headers() }, `/uploads/${path}`, {
      passthroughHeaders: [
        'content-type',
        'content-disposition',
        'content-length',
        'cache-control',
      ],
    })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
