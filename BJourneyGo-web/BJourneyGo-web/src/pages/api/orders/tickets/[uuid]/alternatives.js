import { forwardJson } from '../../../_lib/proxy.js'

export async function GET({ request, params }) {
  try {
    const url = new URL(request.url)
    const qs = url.searchParams.toString()
    const ticketUuid = String(params?.uuid || '').trim()
    if (!ticketUuid) {
      return new Response(JSON.stringify({ error: 'invalid uuid' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    return forwardJson(request, `/orders/tickets/${encodeURIComponent(ticketUuid)}/alternatives${qs ? `?${qs}` : ''}`, { forwardAuth: true })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
