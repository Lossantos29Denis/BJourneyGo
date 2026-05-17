import { forwardJson } from '../../_lib/proxy.js'

export async function GET({ request }) {
  try {
    return forwardJson(request, '/tickets/scanner/active-session', { forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
