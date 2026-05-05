import { fetchWithAuth, clearAuth } from '/src/scripts/api.js'

// Auto-select country in the prefix <select> based on phone prefix
function detectCountryFromPhone(phone) {
  const select = document.getElementById('phoneCountry')
  if (!select || !phone) return
  for (const opt of select.options) {
    const prefix = opt.getAttribute('data-prefix')
    if (prefix && phone.startsWith(prefix)) {
      select.value = opt.value
      return
    }
  }
}

// Protect page: redirect if not authenticated and load user
if (typeof window !== 'undefined') {
  const authed = localStorage.getItem('auth') === 'true';
  if (!authed) {
    location.replace('/');
  } else {
    (async () => {
      try {
        const res = await fetchWithAuth('/api/me', { method: 'GET' })
        if (res.ok) {
          const json = await res.json()
          const user = json.user || {}
          document.getElementById('email').value = user.email || '';
          document.getElementById('displayName').value = user.name || (user.email || '').split('@')[0] || 'Usuario';
          document.getElementById('phone').value = user.phone || '';
          if (user.phoneCountry) {
            document.getElementById('phoneCountry').value = user.phoneCountry
          } else {
            detectCountryFromPhone(user.phone || '')
          }
        } else {
          const stored = localStorage.getItem('user') || '';
          document.getElementById('email').value = stored;
          document.getElementById('displayName').value = stored.split('@')[0] || 'Usuario';
        }
      } catch (e) {
        const stored = localStorage.getItem('user') || '';
        document.getElementById('email').value = stored;
        document.getElementById('displayName').value = stored.split('@')[0] || 'Usuario';
      }
    })()
  }
}

// Phone prefix <select> — when a country is picked, prefill the phone input with the prefix
const phoneCountrySelect = document.getElementById('phoneCountry')
const phoneInput = document.getElementById('phone')
phoneCountrySelect?.addEventListener('change', () => {
  const selected = phoneCountrySelect.selectedOptions[0]
  const prefix = selected?.getAttribute('data-prefix') || ''
  if (!prefix || !phoneInput) return
  const current = phoneInput.value.trim()
  // Replace if empty or only contains a previous prefix
  if (!current || /^\+\d{1,4}\s?$/.test(current)) {
    phoneInput.value = prefix + ' '
    phoneInput.focus()
  }
})

// Profile form handler
const profileForm = document.getElementById('profileForm');
profileForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('displayName')?.value || ''
  const phone = document.getElementById('phone')?.value || ''
  const phoneCountry = document.getElementById('phoneCountry')?.value || ''
  try {
    const res = await fetchWithAuth('/api/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, phoneCountry }) })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error || 'Error al guardar')
      return
    }
    // Update stored display name and refresh the header immediately
    const displayName = json.user?.name || json.user?.email || name
    localStorage.setItem('user', displayName)
    const headerNameEl = document.getElementById('userName')
    if (headerNameEl) headerNameEl.textContent = displayName
    alert('Cambios guardados correctamente')
  } catch (e) {
    alert('Error de conexión al guardar cambios')
  }
});

// Password form handler
const passwordForm = document.getElementById('passwordForm');
passwordForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const current = document.getElementById('currentPassword')?.value || ''
  const newPass = document.getElementById('newPassword')?.value || ''
  const confirmPass = document.getElementById('confirmPassword')?.value || ''

  if (newPass !== confirmPass) {
    alert('Las contraseñas no coinciden.');
    return;
  }

  if (newPass.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres.');
    return;
  }

  try {
    const res = await fetchWithAuth('/api/me', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: current, newPassword: newPass }) })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error || 'Error al cambiar contraseña')
      return
    }
    alert('Contraseña cambiada correctamente')
    passwordForm.reset()
  } catch (e) {
    alert('Error de conexión al cambiar contraseña')
  }
});

// Delete account handler
const deleteBtn = document.getElementById('deleteAccountBtn');
deleteBtn?.addEventListener('click', async () => {
  const confirmDelete = window.confirm('¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer.')
  if (!confirmDelete) return

  const pwd = window.prompt('Por favor confirma tu contraseña para eliminar la cuenta:')
  if (!pwd) return

  try {
    const res = await fetchWithAuth('/api/me', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ currentPassword: pwd }) })
    const json = await res.json()
    if (!res.ok) {
      alert(json.error || 'Error al eliminar cuenta')
      return
    }
    clearAuth()
    alert('Cuenta eliminada correctamente')
    location.replace('/')
  } catch (e) {
    alert('Error de conexión al eliminar cuenta')
  }
});
