const API_URL = process.env.API_URL || 'http://localhost:4000'

function copyAuth(request) {
  const headers = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const qs = url.searchParams.toString()
    const resp = await fetch(`${API_URL}/admin/users${qs ? `?${qs}` : ''}`, { headers: copyAuth(request) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json()
    const resp = await fetch(`${API_URL}/admin/users`, { method: 'POST', headers: copyAuth(request), body: JSON.stringify(body) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function PUT({ request }) {
  try {
    const body = await request.json()
    const resp = await fetch(`${API_URL}/admin/users/${body.id}`, { method: 'PUT', headers: copyAuth(request), body: JSON.stringify(body) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request }) {
  try {
    const body = await request.json()
    const resp = await fetch(`${API_URL}/admin/users/${body.id}`, { method: 'DELETE', headers: copyAuth(request) })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
