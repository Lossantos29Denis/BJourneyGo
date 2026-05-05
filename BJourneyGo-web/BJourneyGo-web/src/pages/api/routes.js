const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function GET() {
  try {
    const resp = await fetch(`${API_URL}/routes`)
    const json = await resp.json()
    return new Response(JSON.stringify(json), { status: resp.status, headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
