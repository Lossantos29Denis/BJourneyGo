import { forwardJson, readJsonBody } from '../_lib/proxy.js'

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const qs = url.searchParams.toString()
    return forwardJson(request, `/admin/users${qs ? `?${qs}` : ''}`, { forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, '/admin/users', { method: 'POST', body, forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function PUT({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, `/admin/users/${body.id}`, { method: 'PUT', body, forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, `/admin/users/${body.id}`, { method: 'DELETE', forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
