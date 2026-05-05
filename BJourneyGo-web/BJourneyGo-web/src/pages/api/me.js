const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function GET({ request }) {
  try {
    const headers = {}
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
    const resp = await fetch(`${API_URL}/auth/me`, { headers })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function PUT({ request }) {
  try {
    const body = await request.json()
    const headers = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
    const resp = await fetch(`${API_URL}/auth/me`, { method: 'PUT', headers, body: JSON.stringify(body) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json()
    const headers = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
    // assume this POST is for change-password
    const resp = await fetch(`${API_URL}/auth/me/change-password`, { method: 'POST', headers, body: JSON.stringify(body) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request }) {
  try {
    const body = await request.json().catch(() => ({}))
    const headers = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
    const resp = await fetch(`${API_URL}/auth/me`, { method: 'DELETE', headers, body: JSON.stringify(body) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
