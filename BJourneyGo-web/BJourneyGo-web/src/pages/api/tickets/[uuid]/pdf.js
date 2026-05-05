const API_URL = process.env.API_URL || 'http://localhost:4000'

export async function GET({ params, request }) {
  const uuid = params.uuid
  try {
    const auth = request.headers.get('authorization')
    const headers = {}
    if (auth) headers['Authorization'] = auth

    const resp = await fetch(`${API_URL}/payments/tickets/${uuid}/pdf`, { headers })

    if (!resp.ok) {
      const msg = await resp.text().catch(() => 'error')
      return new Response(msg, { status: resp.status, headers: { 'Content-Type': 'application/json' } })
    }

    const pdfBuffer = await resp.arrayBuffer()
    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ticket-${uuid.slice(0, 8)}.pdf"`,
        'Content-Length': String(pdfBuffer.byteLength),
      }
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: 'proxy error' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
