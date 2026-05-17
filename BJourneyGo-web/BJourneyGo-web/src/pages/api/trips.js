import { forwardJson } from './_lib/proxy.js'

export async function GET({ request }) {
  try {
    const url = new URL(request.url)
    const qs = url.searchParams.toString()
    return forwardJson(request, `/trips${qs ? `?${qs}` : ''}`, {
      responseHeaders: {
        'Cache-Control': 'public, max-age=60, stale-while-revalidate=300'
      }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
