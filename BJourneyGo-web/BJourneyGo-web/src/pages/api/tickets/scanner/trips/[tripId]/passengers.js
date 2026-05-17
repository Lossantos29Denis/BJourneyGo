import { forwardJson } from '../../../../_lib/proxy.js'

export async function GET({ request, params }) {
  try {
    const tripId = Number(params?.tripId)
    if (!tripId) {
      return new Response(JSON.stringify({ error: 'invalid tripId' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return forwardJson(request, `/tickets/scanner/trips/${tripId}/passengers`, {
      forwardAuth: true,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
