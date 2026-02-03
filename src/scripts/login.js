const form = document.getElementById('loginForm');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const identityEl = document.getElementById('email');
  const identity = identityEl ? (identityEl.value || '').trim() : '';
  const password = document.getElementById('password')?.value || '';

  if (!identity || !password) {
    alert('Por favor completa el correo/usuario y la contraseña.');
    return;
  }

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity, password })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Credenciales inválidas');
      return;
    }

    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', data.user);
    localStorage.setItem('isAdmin', data.isAdmin ? 'true' : 'false');
    location.replace('/');
  } catch (error) {
    alert('Error de conexión');
  }
});
