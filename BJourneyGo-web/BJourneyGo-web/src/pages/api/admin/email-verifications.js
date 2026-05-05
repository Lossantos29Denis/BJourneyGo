const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function GET({ request }) {
  try {
    const headers = { 'Content-Type': 'application/json' }
    const auth = request.headers.get('authorization')
    if (auth) headers['Authorization'] = auth
    const url = new URL(request.url)
    const limit = url.searchParams.get('limit') || '50'
    const offset = url.searchParams.get('offset') || '0'
    const resp = await fetch(`${API_URL}/admin/email-tokens/verification-logs?limit=${encodeURIComponent(limit)}&offset=${encodeURIComponent(offset)}`, {
      method: 'GET',
      headers
    })
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}