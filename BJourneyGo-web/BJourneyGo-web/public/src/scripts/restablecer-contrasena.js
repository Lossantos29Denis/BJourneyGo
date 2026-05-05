const form = document.getElementById('resetForm')
const passwordInput = document.getElementById('password')
const confirmInput = document.getElementById('confirm')
const submitBtn = document.getElementById('submitBtn')
const subtitleEl = document.getElementById('subtitle')
const pageTitleEl = document.getElementById('pageTitle')
const statusMsg = document.getElementById('statusMsg')
const loginAction = document.getElementById('loginAction')

const token = new URLSearchParams(window.location.search).get('token')

if (!token) {
  if (pageTitleEl) pageTitleEl.textContent = 'Enlace no válido'
  if (subtitleEl) subtitleEl.textContent = 'Este enlace de restablecimiento no es válido o ha expirado.'
  if (form) form.style.display = 'none'
}

function showStatus(msg, color, showLogin) {
  if (subtitleEl) subtitleEl.style.display = 'none'
  if (form) form.style.display = 'none'
  statusMsg.textContent = msg
  statusMsg.style.color = color || 'inherit'
  statusMsg.style.display = 'block'
  if (showLogin && loginAction) loginAction.style.display = 'flex'
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const password = String(passwordInput?.value || '')
  const confirm = String(confirmInput?.value || '')

  if (password.length < 6) {
    statusMsg.textContent = 'La contraseña debe tener al menos 6 caracteres.'
    statusMsg.style.color = '#f87171'
    statusMsg.style.display = 'block'
    return
  }
  if (password !== confirm) {
    statusMsg.textContent = 'Las contraseñas no coinciden.'
    statusMsg.style.color = '#f87171'
    statusMsg.style.display = 'block'
    return
  }

  submitBtn.disabled = true
  submitBtn.textContent = 'Guardando...'
  statusMsg.style.display = 'none'

  try {
    const res = await fetch('/api/auth/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      submitBtn.disabled = false
      submitBtn.textContent = 'Cambiar contraseña'
      showStatus(json.error || 'El enlace no es válido o ha expirado.', '#f87171', false)
      return
    }
    showStatus('¡Contraseña actualizada correctamente! Ya puedes iniciar sesión.', '#4ade80', true)
  } catch (err) {
    submitBtn.disabled = false
    submitBtn.textContent = 'Cambiar contraseña'
    showStatus('Error de conexión. Inténtalo de nuevo.', '#f87171', false)
  }
})
