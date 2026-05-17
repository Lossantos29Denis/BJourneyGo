import { forwardJson, readJsonBody } from './_lib/proxy.js';

export async function POST({ request }) {
  try {
    const body = await readJsonBody(request, {})
    const { email, password, name } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Forward to central API
    return forwardJson(request, '/auth/register', {
      method: 'POST',
      body: { email, password, name },
    })
  } catch (error) {
    console.error('Register proxy error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al registrar usuario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
