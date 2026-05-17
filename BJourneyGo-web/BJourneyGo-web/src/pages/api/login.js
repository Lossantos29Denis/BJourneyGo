import { forwardJson, readJsonBody } from './_lib/proxy.js';

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    const { identity, email, password } = body;
    const normalizedIdentity = identity || email;

    if (!normalizedIdentity || !password) {
      return new Response(
        JSON.stringify({ error: 'Usuario y contraseña requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Forward to central API
    return forwardJson(request, '/auth/login', {
      method: 'POST',
      body: { email: normalizedIdentity, password },
    })
  } catch (error) {
    console.error('Login proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
