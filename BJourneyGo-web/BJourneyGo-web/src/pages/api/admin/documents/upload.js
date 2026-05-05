const API_URL = process.env.API_URL || 'http://localhost:4000'

function buildHeaders(request) {
  const headers = {}
  const auth = request.headers.get('authorization')
  if (auth) headers['Authorization'] = auth
  return headers
}

export async function POST({ request }) {
  try {
    const formData = await request.formData()
    const resp = await fetch(`${API_URL}/admin/documents/upload`, {
      method: 'POST',
      headers: buildHeaders(request),
      body: formData
    })

    const contentType = resp.headers.get('content-type') || 'application/json'
    const bodyText = await resp.text()

    return new Response(bodyText, {
      status: resp.status,
      headers: { 'Content-Type': contentType }
    })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
