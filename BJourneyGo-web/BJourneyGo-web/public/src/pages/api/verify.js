const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const token = url.searchParams.get('token')
    if (!token) {
      return new Response(JSON.stringify({ error: 'token required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    }
    const resp = await fetch(`${API_URL}/auth/verify?token=${encodeURIComponent(token)}`)
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
