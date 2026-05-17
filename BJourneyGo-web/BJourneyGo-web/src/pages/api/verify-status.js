import { forwardJson } from './_lib/proxy.js'

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const jti = url.searchParams.get('jti')
    if (!jti) {
      return new Response(JSON.stringify({ error: 'jti required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    return forwardJson(request, `/auth/verify-status?jti=${encodeURIComponent(jti)}`)
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}