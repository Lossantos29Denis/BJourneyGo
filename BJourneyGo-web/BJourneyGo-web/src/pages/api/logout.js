import { forwardJson, readJsonBody } from './_lib/proxy.js'

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    const { refreshToken } = body
    return forwardJson(request, '/auth/logout', {
      method: 'POST',
      body: { refreshToken },
      forwardAuth: true,
    })
  } catch (err) {
    console.error('Logout proxy error:', err)
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
