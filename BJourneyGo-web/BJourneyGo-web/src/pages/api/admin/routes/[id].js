const API_URL = process.env.API_URL || 'http://localhost:4000'

function copyAuth(request) {
  const headers = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

export async function PUT({ request, params }) {
  try {
    const id = params.id
    const body = await request.json()
    const resp = await fetch(`${API_URL}/admin/routes/${id}`, { method: 'PUT', headers: copyAuth(request), body: JSON.stringify(body) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request, params }) {
  try {
    const id = params.id
    const resp = await fetch(`${API_URL}/admin/routes/${id}`, { method: 'DELETE', headers: copyAuth(request) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function GET({ request, params }) {
  try {
    const id = params.id
    const resp = await fetch(`${API_URL}/admin/routes/${id}`, { headers: copyAuth(request) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
