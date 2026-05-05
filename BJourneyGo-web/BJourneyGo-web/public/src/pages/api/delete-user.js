// Archivo eliminado - funcionalidad no disponible
export async function POST() {
  return new Response(
    JSON.stringify({ success: false, message: 'Endpoint no disponible' }),
    { status: 404, headers: { 'Content-Type': 'application/json' } }
  );
}
