const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function GET({ request }) {
  try {
    const auth = request.headers.get('authorization')
    const headers = { 'Content-Type': 'application/json' }
    if (auth) headers['Authorization'] = auth
    const resp = await fetch(`${API_URL}/orders/my`, { headers })
    const json = await resp.json().catch(() => ({}))
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
