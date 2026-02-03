// Protect page: redirect if not authenticated
if (typeof window !== 'undefined') {
  const authed = localStorage.getItem('auth') === 'true';
  if (!authed) {
    location.replace('/');
  } else {
    // Load user data
    const user = localStorage.getItem('user') || '';
    document.getElementById('email').value = user;
    document.getElementById('displayName').value = user.split('@')[0] || 'Usuario';
  }
}

// Profile form handler
const profileForm = document.getElementById('profileForm');
profileForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  alert('Cambios guardados (demo). En producción se enviarían al servidor.');
});

// Password form handler
const passwordForm = document.getElementById('passwordForm');
passwordForm?.addEventListener('submit', (e) => {
  e.preventDefault();
  const newPass = document.getElementById('newPassword')?.value;
  const confirmPass = document.getElementById('confirmPassword')?.value;
  
  if (newPass !== confirmPass) {
    alert('Las contraseñas no coinciden.');
    return;
  }
  
  if (newPass.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  alert('Contraseña cambiada (demo). En producción se enviaría al servidor.');
  passwordForm.reset();
});

// Delete account handler
const deleteBtn = document.getElementById('deleteAccountBtn');
deleteBtn?.addEventListener('click', () => {
  const confirm = window.confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.');
  if (confirm) {
    localStorage.removeItem('auth');
    localStorage.removeItem('user');
    localStorage.removeItem('isAdmin');
    alert('Cuenta eliminada (demo).');
    location.replace('/');
  }
});
