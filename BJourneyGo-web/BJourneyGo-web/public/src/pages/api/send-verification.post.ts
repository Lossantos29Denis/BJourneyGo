// Verification endpoint removed — return 410 Gone
export async function post() {
  return new Response(JSON.stringify({ ok: false, error: 'Verification feature removed' }), { status: 410 });
}
