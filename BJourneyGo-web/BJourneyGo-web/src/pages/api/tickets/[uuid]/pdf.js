import { forwardBinary } from '../../_lib/proxy.js'

export async function GET({ params, request }) {
  const uuid = params.uuid
  try {
    return forwardBinary(request, `/payments/tickets/${uuid}/pdf`, {
      forwardAuth: true,
      contentType: 'application/pdf',
      contentDisposition: `attachment; filename="ticket-${uuid.slice(0, 8)}.pdf"`,
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
