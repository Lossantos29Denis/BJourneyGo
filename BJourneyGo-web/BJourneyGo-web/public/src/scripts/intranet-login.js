const form = document.getElementById('intranetLoginForm');
const errorMessage = document.getElementById('error-message');

form?.addEventListener('submit', async (e) => {
  e.preventDefault();

  const email = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    // Validar contra el servidor
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, email, password })
    });

    const data = await res.json();

    const role = data.role || (data.isAdmin ? 'admin' : 'user');
    const scannerEnabled = Boolean(data.scannerEnabled);
    const intranetRole = role;
     const isAdmin = Boolean(data.isAdmin);

    if (res.ok && data.success && (data.isAdmin || intranetRole === 'agency' || intranetRole === 'scanner' || scannerEnabled)) {
      // Login exitoso - admin, agencia o escaner
      localStorage.setItem('intranetAuth', 'true');
      localStorage.setItem('intranetUser', data.user);
      localStorage.setItem('intranetRole', intranetRole);
       localStorage.setItem('intranetIsAdmin', isAdmin ? 'true' : 'false');
      localStorage.setItem('intranetScannerEnabled', scannerEnabled ? 'true' : 'false');
      localStorage.setItem('agencyId', data.agencyId || '');
      localStorage.setItem('agencyName', data.agencyName || '');
      if (data.token) localStorage.setItem('bjourney_token', data.token);
      if (data.refreshToken) localStorage.setItem('bjourney_refresh', data.refreshToken);
      window.location.href = '/intranet';
    } else if (res.ok && data.success && !data.isAdmin && !scannerEnabled && intranetRole !== 'agency' && intranetRole !== 'scanner') {
      // Usuario válido pero no tiene permisos
      errorMessage.innerHTML = '<strong>Acceso denegado</strong>Tu cuenta no tiene permisos para acceder a la Intranet. Solo administración, agencias autorizadas y operadores escáner pueden acceder.';
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
