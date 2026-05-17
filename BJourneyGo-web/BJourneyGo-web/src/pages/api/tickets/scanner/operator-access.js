import { forwardJson, readJsonBody } from '../../_lib/proxy.js'

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const operatorUserId = String(url.searchParams.get('operatorUserId') || '').trim()
    if (!operatorUserId) {
      return new Response(JSON.stringify({ error: 'operatorUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return forwardJson(
      request,
      `/tickets/scanner/operators/${encodeURIComponent(operatorUserId)}/access`,
      { forwardAuth: true }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function PUT({ request }) {
  try {
    const body = await readJsonBody(request, {})
    const operatorUserId = String(body?.operatorUserId || '').trim()
    if (!operatorUserId) {
      return new Response(JSON.stringify({ error: 'operatorUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return forwardJson(
      request,
      `/tickets/scanner/operators/${encodeURIComponent(operatorUserId)}/access`,
      {
        method: 'PUT',
        body: { tripIds: Array.isArray(body?.tripIds) ? body.tripIds : [] },
        forwardAuth: true,
      }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
