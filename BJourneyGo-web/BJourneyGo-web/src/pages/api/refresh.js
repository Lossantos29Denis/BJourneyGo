import { forwardJson, readJsonBody } from './_lib/proxy.js';

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    const { refreshToken } = body;
    if (!refreshToken) return new Response(JSON.stringify({ error: 'refreshToken required' }), { status: 400, headers: { 'Content-Type': 'application/json' } })

    return forwardJson(request, '/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    })
  } catch (err) {
    console.error('Refresh proxy error:', err)
    return new Response(JSON.stringify({ error: 'server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
