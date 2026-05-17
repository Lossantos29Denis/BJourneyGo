import { forwardJson } from '../_lib/proxy.js'
export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') || '50'
    const offset = url.searchParams.get('offset') || '0'
    url.searchParams.set('limit', limit)
    url.searchParams.set('offset', offset)
    const qs = url.searchParams.toString()
    return forwardJson(
      request,
      `/admin/email-tokens/verification-logs${qs ? `?${qs}` : ''}`,
      { forwardAuth: true }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}