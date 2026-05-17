import { forwardFormData } from '../../_lib/proxy.js'

export async function POST({ request }) {
  try {
    return forwardFormData(request, '/admin/documents/upload', { forwardAuth: true })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}
