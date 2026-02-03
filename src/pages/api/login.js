import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data/users.json');
const ADMIN_USER = 'sergio';
const ADMIN_PASS = '123456';

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data).users || {};
  } catch {
    return {};
  }
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { identity, password } = body;

    if (!identity || !password) {
      return new Response(
        JSON.stringify({ error: 'Usuario y contraseña requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check admin
    if (identity.toLowerCase() === ADMIN_USER && password === ADMIN_PASS) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          user: ADMIN_USER, 
          isAdmin: true,
          role: 'admin'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check registered users
    const users = readUsers();
    if (users[identity] && users[identity].password === password) {
      const userData = users[identity];
      return new Response(
        JSON.stringify({ 
          success: true, 
          user: identity, 
          isAdmin: userData.isAdmin || false,
          role: userData.role || (userData.isAdmin ? 'admin' : 'user'),
          agencyId: userData.agencyId || '',
          agencyName: userData.agencyName || ''
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Usuario o contraseña incorrectos' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ error: 'Error en el servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
