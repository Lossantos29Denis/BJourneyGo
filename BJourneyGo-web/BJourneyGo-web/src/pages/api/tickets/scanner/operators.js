const API_URL = process.env.API_URL || 'http://localhost:4000'

function copyAuth(request) {
  const headers = { 'Content-Type': 'application/json' }
  const auth = request.headers.get('authorization')
  if (auth) headers.Authorization = auth
  return headers
}

export async function GET({ request }) {
  try {
    const resp = await fetch(`${API_URL}/tickets/scanner/operators`, {
      headers: copyAuth(request),
    })
    const json = await resp.json().catch(() => ({}))
    return new Response(JSON.stringify(json), {
      status: resp.status,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
