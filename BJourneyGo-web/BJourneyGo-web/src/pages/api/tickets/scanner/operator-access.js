const API_URL = process.env.API_URL || 'http://localhost:4000'

function copyAuth(request) {
  const headers = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers.Authorization = auth
  return headers
}

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

    const resp = await fetch(`${API_URL}/tickets/scanner/operators/${encodeURIComponent(operatorUserId)}/access`, {
      headers: copyAuth(request),
    })
    const json = await resp.json().catch(() => ({}))
    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function PUT({ request }) {
  try {
    const body = await request.json().catch(() => ({}))
    const operatorUserId = String(body?.operatorUserId || '').trim()
    if (!operatorUserId) {
      return new Response(JSON.stringify({ error: 'operatorUserId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const resp = await fetch(`${API_URL}/tickets/scanner/operators/${encodeURIComponent(operatorUserId)}/access`, {
      method: 'PUT',
      headers: copyAuth(request),
      body: JSON.stringify({ tripIds: Array.isArray(body?.tripIds) ? body.tripIds : [] }),
    })
    const json = await resp.json().catch(() => ({}))
    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
