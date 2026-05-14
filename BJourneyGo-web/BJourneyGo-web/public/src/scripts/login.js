const form = document.getElementById('loginForm');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identityEl = document.getElementById('email');
  const email = identityEl ? (identityEl.value || '').trim() : '';
  const password = document.getElementById('password')?.value || '';

  if (!email || !password) {
    alert('Por favor completa el correo/usuario y la contraseña.');
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, email, password })
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data.error === 'email not verified'
        ? 'Debes verificar tu correo antes de iniciar sesión.'
        : (data.error || 'Credenciales inválidas')
      alert(msg);
      return;
    }

    // store tokens if provided
    if (data.token) localStorage.setItem('bjourney_token', data.token)
    if (data.refreshToken) localStorage.setItem('bjourney_refresh', data.refreshToken)

    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', data.user);
    localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false');

    // Also set intranet auth for admin/agency/scanner users so they can access gestion-billetes
    const userRole = data.role || (data.isAdmin ? 'admin' : 'user');
    if (data.isAdmin || userRole === 'agency' || userRole === 'scanner' || data.scannerEnabled) {
      localStorage.setItem('intranetAuth', 'true');
      localStorage.setItem('intranetUser', data.user);
      localStorage.setItem('intranetRole', userRole);
      localStorage.setItem('intranetIsAdmin', data.isAdmin ? 'true' : 'false');
      localStorage.setItem('intranetScannerEnabled', data.scannerEnabled ? 'true' : 'false');
      localStorage.setItem('agencyId', data.agencyId || '');
      localStorage.setItem('agencyName', data.agencyName || '');
    }

    location.replace('/');
  } catch (error) {
    alert('Error de conexión');
  }
});
