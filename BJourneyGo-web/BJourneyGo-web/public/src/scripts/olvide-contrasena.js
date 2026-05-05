const form = document.getElementById('forgotForm')
const emailInput = document.getElementById('email')
const submitBtn = document.getElementById('submitBtn')
const subtitleEl = document.getElementById('subtitle')
const statusMsg = document.getElementById('statusMsg')

function showStatus(msg, color) {
  if (subtitleEl) subtitleEl.style.display = 'none'
  if (form) form.style.display = 'none'
  statusMsg.textContent = msg
  statusMsg.style.color = color || 'inherit'
  statusMsg.style.display = 'block'
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = String(emailInput?.value || '').trim()
  if (!email) return

  submitBtn.disabled = true
  submitBtn.textContent = 'Enviando...'

  try {
    const res = await fetch('/api/auth/send-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    // API always returns success:true to avoid leaking whether the email exists
    showStatus('Si el correo está registrado, recibirás un enlace en tu bandeja de entrada. Revisa también la carpeta de spam.', '#4ade80')
  } catch (err) {
    submitBtn.disabled = false
    submitBtn.textContent = 'Enviar enlace'
    showStatus('Error de conexión. Inténtalo de nuevo.', '#f87171')
  }
})
