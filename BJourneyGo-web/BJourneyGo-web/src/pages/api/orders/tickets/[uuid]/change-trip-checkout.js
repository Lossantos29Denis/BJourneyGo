import { forwardJson, readJsonBody } from '../../../_lib/proxy.js'

export async function POST({ request, params }) {
  try {
    const body = await readJsonBody(request, {})
    const ticketUuid = String(params?.uuid || '').trim()
    if (!ticketUuid) {
      return new Response(JSON.stringify({ error: 'invalid uuid' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    return forwardJson(request, '/payments/stripe/change-trip-checkout', {
      method: 'POST',
      body: { ...body, ticketUuid },
      forwardAuth: true,
    })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
