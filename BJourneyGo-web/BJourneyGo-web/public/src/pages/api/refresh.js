const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { refreshToken } = body;
    if (!refreshToken) return new Response(JSON.stringify({ error: 'refreshToken required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    const resp = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Refresh proxy error:', err)
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
