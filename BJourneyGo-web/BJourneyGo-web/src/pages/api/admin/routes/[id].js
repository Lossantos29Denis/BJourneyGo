import { forwardJson, readJsonBody } from '../../_lib/proxy.js'

export async function PUT({ request, params }) {
  try {
    const id = params.id
    const body = await readJsonBody(request, {})
    return forwardJson(request, `/admin/routes/${id}`, {
      method: 'PUT',
      body,
      forwardAuth: true,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request, params }) {
  try {
    const id = params.id
    return forwardJson(request, `/admin/routes/${id}`, { method: 'DELETE', forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function GET({ request, params }) {
  try {
    const id = params.id
    return forwardJson(request, `/admin/routes/${id}`, { forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
