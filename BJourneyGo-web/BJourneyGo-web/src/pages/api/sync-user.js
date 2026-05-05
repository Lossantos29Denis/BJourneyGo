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
    const { username, password, role = 'empleado', isAdmin = false, agencyId, agencyName } = body;

    if (!username || !password) {
      return new Response(
        JSON.stringify({ error: 'Usuario y contraseña requeridos' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const users = readUsers();
    
    // Crear entrada de usuario con todos los campos necesarios
    users[username] = { 
      password, 
      isAdmin: isAdmin || role === 'admin',
      role: role,
      ...(role === 'agency' && agencyId && agencyName && {
        agencyId,
        agencyName
      })
    };
    
    writeUsers(users);

    return new Response(
      JSON.stringify({ success: true, message: 'Usuario sincronizado' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Sync error:', error);
    return new Response(
      JSON.stringify({ error: 'Error al sincronizar usuario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
