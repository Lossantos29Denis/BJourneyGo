import { forwardJson } from './_lib/proxy.js'

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    return forwardJson(request, `/auth/verify?token=${encodeURIComponent(token)}`)
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}