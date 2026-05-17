import { forwardJson, readJsonBody } from '../_lib/proxy.js'

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, '/payments/stripe/checkout', {
      method: 'POST',
      body,
      forwardAuth: true,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}