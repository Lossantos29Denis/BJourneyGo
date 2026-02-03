const form = document.getElementById('registerForm');
form?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email')?.value?.trim();
  const password = document.getElementById('password')?.value || '';
  
  if (!email || !password) { 
    alert('Rellena todos los campos'); 
    return; 
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    
    if (!res.ok) {
      alert(data.error || 'Error al registrar');
      return;
    }

    alert('Usuario registrado exitosamente');
    // Log in the user
    localStorage.setItem('auth', 'true');
    localStorage.setItem('user', email);
    localStorage.setItem('isAdmin', 'false');
    location.replace('/');
  } catch (error) {
    alert('Error de conexión');
  }
});
