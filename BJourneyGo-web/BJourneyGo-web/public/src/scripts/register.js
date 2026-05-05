import { fetchWithAuth, getToken, setRefreshToken, setToken } from '/src/scripts/api.js'

const form = document.getElementById('registerForm')
const modal = document.getElementById('verifyModal')
const verifyEmail = document.getElementById('verifyEmail')
const verifyStatus = document.getElementById('verifyStatus')
const openGmailBtn = document.getElementById('openGmailBtn')
const resendVerifyBtn = document.getElementById('resendVerifyBtn')
const checkVerificationBtn = document.getElementById('checkVerificationBtn')

let pollTimer = null
let pendingPassword = null

function setStatus(message) {
  if (verifyStatus) verifyStatus.textContent = message || ''
}

async function resendVerification() {
  try {
    const email = localStorage.getItem('pending_email')
    const verificationId = localStorage.getItem('pending_verification_id')
    const res = await fetch('/api/resend-verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, verificationId })
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (json.code === 'MAIL_DISABLED') {
        setStatus('Temporalmente no disponible.')
        return
      }
      if (json.code === 'RATE_LIMIT') {
        setStatus('Espera un momento antes de reenviar.')
        return
      }
      setStatus('No se pudo reenviar. Intenta mas tarde.')
      return
    }
    if (json.alreadyVerified) {
      setStatus('Tu cuenta ya esta verificada.')
      return
    }
    if (json.verificationId) {
      localStorage.setItem('pending_verification_id', json.verificationId)
    }
    setStatus('Correo reenviado. Revisa tu bandeja de entrada.')
  } catch (e) {
    setStatus('No se pudo reenviar. Intenta mas tarde.')
  }
}

function openGmail() {
  window.open('https://mail.google.com', '_blank', 'noopener')
}

function showModal(email, verificationId, password) {
  if (!modal) return
  modal.classList.add('is-visible')
  modal.setAttribute('aria-hidden', 'false')
  if (verifyEmail) verifyEmail.textContent = email
  localStorage.setItem('pending_verification', 'true')
  if (verificationId) localStorage.setItem('pending_verification_id', verificationId)
  if (password) {
    pendingPassword = password
    sessionStorage.setItem('pending_password', password)
  }
  localStorage.setItem('pending_email', email)
  setStatus('Esperando confirmacion...')
  startPolling()
  openGmail()
}

function hideModal() {
  if (!modal) return
  modal.classList.remove('is-visible')
  modal.setAttribute('aria-hidden', 'true')
}

async function checkVerification() {
  try {
    const verificationId = localStorage.getItem('pending_verification_id')
    if (!verificationId) return
    setStatus('Comprobando verificacion...')
    const res = await fetch(`/api/verify-status?jti=${encodeURIComponent(verificationId)}`)
    const json = await res.json().catch(() => ({}))
    if (!res.ok) return

    if (!json?.verified) {
      setStatus('Aun no esta verificado. Esperando...')
      return
    }

    stopPolling()
    const email = localStorage.getItem('pending_email')
    const pwd = pendingPassword || sessionStorage.getItem('pending_password')
    if (!email || !pwd) {
      setStatus('Cuenta verificada. Inicia sesion para continuar.')
      setTimeout(() => location.replace('/login'), 1200)
      return
    }

    const loginRes = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, email, password: pwd })
    })
    const loginJson = await loginRes.json().catch(() => ({}))
    if (!loginRes.ok) {
      setStatus('Cuenta verificada. Inicia sesion para continuar.')
      setTimeout(() => location.replace('/login'), 1200)
      return
    }

    if (loginJson.token) setToken(loginJson.token)
    if (loginJson.refreshToken) setRefreshToken(loginJson.refreshToken)
    localStorage.setItem('auth', 'true')
    localStorage.setItem('user', loginJson.user || email)
    localStorage.setItem('isAdmin', loginJson.isAdmin ? 'true' : 'false')
    localStorage.removeItem('pending_verification')
    localStorage.removeItem('pending_email')
    localStorage.removeItem('pending_verification_id')
    sessionStorage.removeItem('pending_password')
    hideModal()
    location.replace('/')
  } catch (e) {
    setStatus('Error al comprobar. Reintentando...')
  }
}

function stopPolling() {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(checkVerification, 4000)
  checkVerification()
}

openGmailBtn?.addEventListener('click', () => openGmail())
resendVerifyBtn?.addEventListener('click', () => resendVerification())
checkVerificationBtn?.addEventListener('click', () => checkVerification())

if (localStorage.getItem('pending_verification') === 'true') {
  startPolling()
}

form?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const email = document.getElementById('email')?.value?.trim()
  const password = document.getElementById('password')?.value || ''

  if (!email || !password) {
    alert('Rellena todos los campos')
    return
  }

  try {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      alert(data.error || 'Error al registrar')
      return
    }

    if (data.token) setToken(data.token)
    if (data.refreshToken) setRefreshToken(data.refreshToken)

    showModal(email, data.verificationId, password)
    if (data.mailDisabled) setStatus('Temporalmente no disponible.')
  } catch (error) {
    alert('Error de conexion')
  }
})
