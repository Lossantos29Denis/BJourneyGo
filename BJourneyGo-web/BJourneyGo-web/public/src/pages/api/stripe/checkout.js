const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function POST({ request }) {
  try {
    const body = await request.json()
    const headers = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
    const resp = await fetch(`${API_URL}/payments/stripe/checkout`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
