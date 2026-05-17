import { forwardJson, readJsonBody } from '../../_lib/proxy.js'

export async function PUT({ request, params }) {
  try {
    const id = params?.id
    if (!id) return new Response(JSON.stringify({ error: 'invalid id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    const body = await readJsonBody(request, {})
    return forwardJson(request, `/admin/documents/${id}`, {
      method: 'PUT',
      body,
      forwardAuth: true,
    })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request, params }) {
  try {
    const id = params?.id
    if (!id) return new Response(JSON.stringify({ error: 'invalid id' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
    return forwardJson(request, `/admin/documents/${id}`, { method: 'DELETE', forwardAuth: true })
  } catch (_e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
