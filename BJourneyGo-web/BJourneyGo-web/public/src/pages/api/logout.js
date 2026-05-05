const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { refreshToken } = body;
    const headers = { 'Content-Type': 'application/json' }
    // forward Authorization header if present (client may send access token)
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth

    const resp = await fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ refreshToken })
    })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('Logout proxy error:', err)
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
