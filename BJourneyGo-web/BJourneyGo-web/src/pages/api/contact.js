export const prerender = false

import { forwardJson, readJsonBody } from './_lib/proxy.js'

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request)
    return forwardJson(request, '/contact', { method: 'POST', body })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
