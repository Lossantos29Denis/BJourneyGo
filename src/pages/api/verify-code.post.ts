// Verification removed — always return gone
export async function post() {
  return new Response(JSON.stringify({ ok: false, error: 'Verification feature removed' }), { status: 410 });
}
