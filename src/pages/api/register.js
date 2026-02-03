import fs from 'fs';
import path from 'path';

const USERS_FILE = path.join(process.cwd(), 'data/users.json');

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf-8');
    return JSON.parse(data).users || {};
  } catch {
    return {};
  }
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify({ users }, null, 2));
}

export async function POST({ request }) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email y contraseña requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const users = readUsers();
    users[email] = { password, isAdmin: false };
    writeUsers(users);

    return new Response(
      JSON.stringify({ success: true, message: 'Usuario registrado' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Register error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al registrar usuario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
