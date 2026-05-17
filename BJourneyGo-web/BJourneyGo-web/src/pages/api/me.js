import { forwardJson, readJsonBody } from './_lib/proxy.js'

export async function GET({ request }) {
  try {
    return forwardJson(request, '/auth/me', { forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function PUT({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, '/auth/me', { method: 'PUT', body, forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, '/auth/me/change-password', { method: 'POST', body, forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}

export async function DELETE({ request }) {
  try {
    const body = await readJsonBody(request, {})
    return forwardJson(request, '/auth/me', { method: 'DELETE', body, forwardAuth: true })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
