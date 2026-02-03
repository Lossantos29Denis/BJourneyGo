const form = document.getElementById('intranetLoginForm');
const errorMessage = document.getElementById('error-message');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    // Validar contra el servidor
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: username, password })
    });

    const data = await res.json();

    if (res.ok && data.success && (data.isAdmin || data.role === 'agency')) {
      // Login exitoso - admin o agencia
      localStorage.setItem('intranetAuth', 'true');
      localStorage.setItem('intranetUser', data.user);
      localStorage.setItem('intranetRole', data.role || (data.isAdmin ? 'admin' : 'user'));
      localStorage.setItem('agencyId', data.agencyId || '');
      localStorage.setItem('agencyName', data.agencyName || '');
      window.location.href = '/intranet';
    } else if (res.ok && data.success && !data.isAdmin && data.role !== 'agency') {
      // Usuario válido pero no tiene permisos
      errorMessage.innerHTML = '<strong>Acceso denegado</strong>Tu cuenta no tiene permisos para acceder a la Intranet. Solo los administradores y agencias autorizadas pueden acceder.';
      errorMessage.style.display = 'block';
      document.getElementById('password').value = '';
      document.getElementById('username').focus();
    } else {
      // Credenciales incorrectas
      errorMessage.innerHTML = '<strong>Credenciales incorrectas</strong>El nombre de usuario o la contraseña son incorrectos. Por favor, verifica tus datos e intenta nuevamente.';
      errorMessage.style.display = 'block';
      document.getElementById('username').value = '';
      document.getElementById('password').value = '';
      document.getElementById('username').focus();
    }
  } catch (error) {
    console.error('Error:', error);
    errorMessage.innerHTML = '<strong>Error de conexión</strong>No se pudo conectar al servidor. Por favor, intenta nuevamente.';
    errorMessage.style.display = 'block';
  }
});
