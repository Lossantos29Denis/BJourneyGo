const titleEl = document.getElementById('verifyTitle')
const messageEl = document.getElementById('verifyMessage')
const loginLink = document.getElementById('verifyLoginLink')
const appLink = document.getElementById('verifyAppHint')

function setStatus(title, message, success) {
  if (titleEl) titleEl.textContent = title
  if (messageEl) messageEl.textContent = message
  if (success) {
    if (loginLink) loginLink.style.display = 'inline-flex'
    if (appLink) appLink.style.display = 'inline-flex'
  }
}

async function run() {
  const params = new URLSearchParams(window.location.search)
  const token = params.get('token')
  if (!token) {
    setStatus('Enlace invalido', 'El enlace de verificacion no es valido.', false)
    return
  }

  try {
    const res = await fetch(`/api/verify?token=${encodeURIComponent(token)}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok || !json.success) {
      setStatus('No se pudo verificar', json.error || 'El enlace no es valido o ya fue usado.', false)
      return
    }
    setStatus('Cuenta verificada', 'Gracias. Tu cuenta ya esta activa.', true)
  } catch (e) {
    setStatus('Error de red', 'No pudimos verificar el enlace. Intenta de nuevo.', false)
  }
}

run()
