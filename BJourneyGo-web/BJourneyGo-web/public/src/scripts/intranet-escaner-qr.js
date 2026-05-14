import { fetchWithAuth } from '/src/scripts/api.js'

let auth = localStorage.getItem('intranetAuth')
const role = localStorage.getItem('intranetRole')
const scannerEnabled = localStorage.getItem('intranetScannerEnabled') === 'true'
const isAdmin = role === 'admin'
const authFlag = localStorage.getItem('auth') === 'true'
const isAdminFlag = localStorage.getItem('isAdmin') === 'true'
if (auth !== 'true' && authFlag && isAdminFlag) {
  localStorage.setItem('intranetAuth', 'true')
  localStorage.setItem('intranetRole', 'admin')
  localStorage.setItem('intranetIsAdmin', 'true')
  auth = 'true'
}
if (auth !== 'true') location.replace('/intranet-login')
if (!['admin', 'agency', 'scanner'].includes(role || '') && !scannerEnabled) location.replace('/intranet')

const form = document.getElementById('scannerForm')
const qrPayloadEl = document.getElementById('qrPayload')
const presentedIdEl = document.getElementById('presentedId')
const tripSelectEl = document.getElementById('tripSelect')
const accessCodeEl = document.getElementById('accessCode')
const activateSessionBtn = document.getElementById('activateSessionBtn')
const refreshTripsBtn = document.getElementById('refreshTripsBtn')
const activeSessionInfoEl = document.getElementById('activeSessionInfo')
const tripPassengersListEl = document.getElementById('tripPassengersList')
const clearBtn = document.getElementById('clearBtn')
const scanBtn = document.getElementById('scanBtn')
const messageEl = document.getElementById('scannerMessage')
const adminOperatorConfigEl = document.getElementById('adminOperatorConfig')
const operatorSelectEl = document.getElementById('operatorSelect')

const modal = document.getElementById('scanResultModal')
const closeModalBtn = document.getElementById('closeScanModal')
const closeModalFooterBtn = document.getElementById('closeScanModalBtn')
const resultBody = document.getElementById('scanResultBody')

let activeSession = null
let operatorsCache = []

// Parse datetime string "YYYY-MM-DD HH:mm:ss" as local time, not UTC
function parseLocalDateTime(dateTimeStr) {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') return new Date(NaN)
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) {
    try {
      return new Date(dateTimeStr)
    } catch (e) {
      return new Date(NaN)
    }
  }
  const [, year, month, day, hour, minute, second] = match
  return new Date(
    parseInt(year, 10),
    parseInt(month, 10) - 1,
    parseInt(day, 10),
    parseInt(hour, 10),
    parseInt(minute, 10),
    parseInt(second, 10)
  )
}

function fmtDate(value) {
  if (!value) return '—'
  const d = parseLocalDateTime(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function setMessage(text, kind = '') {
  messageEl.textContent = text || ''
  messageEl.className = `scanner-message ${kind}`.trim()
}

function renderActiveSession(session) {
  activeSession = session || null
  if (!session) {
    activeSessionInfoEl.innerHTML = '<span>No hay sesión activa. Debes activar un viaje.</span>'
    return
  }
  activeSessionInfoEl.innerHTML = `
    <strong>Sesión #${session.id || '—'}</strong>
    <span>Viaje ID: ${session.tripId || '—'}</span>
    <span>Código: ${session.accessCode || '—'}</span>
    <span>Ruta: ${(session.origin || '—')} → ${(session.destination || '—')}</span>
    <span>Salida: ${fmtDate(session.departureAt)}</span>
  `
}

function renderTrips(trips) {
  const current = String(activeSession?.tripId || '')
  tripSelectEl.innerHTML = '<option value="">Selecciona un viaje…</option>'
  ;(Array.isArray(trips) ? trips : []).forEach((trip) => {
    const option = document.createElement('option')
    option.value = String(trip.id)
    option.selected = current && String(trip.id) === current
    option.textContent = `#${trip.id} • ${trip.origin || '—'} → ${trip.destination || '—'} • ${fmtDate(trip.departureAt)}`
    tripSelectEl.appendChild(option)
  })
}

function renderOperators(operators) {
  if (!operatorSelectEl) return
  operatorsCache = Array.isArray(operators) ? operators : []
  operatorSelectEl.innerHTML = '<option value="">Este usuario (sesión personal)</option>'
  operatorsCache.forEach((op) => {
    const option = document.createElement('option')
    option.value = String(op.userId)
    const name = op.name || op.email || `Usuario ${op.userId}`
    option.textContent = `${name} • ${op.agencyName || 'Sin agencia'}`
    operatorSelectEl.appendChild(option)
  })
}

function renderPassengers(passengers) {
  const list = Array.isArray(passengers) ? passengers : []
  if (!list.length) {
    tripPassengersListEl.innerHTML = '<p class="muted">No hay pasajeros cargados.</p>'
    return
  }
  tripPassengersListEl.innerHTML = list.slice(0, 120).map((p, idx) => `
    <article class="trip-passenger-item">
      <strong>${p.passengerName || `Pasajero ${idx + 1}`}</strong>
      <span>ID: ${p.passengerIdentification || '—'}</span>
      <span>Tel: ${p.passengerPhone || '—'}</span>
      <span>Estado: ${p.status || 'ACTIVE'}</span>
    </article>
  `).join('')
}

async function loadPassengers(tripId) {
  if (!tripId) {
    renderPassengers([])
    return
  }
  const res = await fetchWithAuth(`/api/tickets/scanner/trips/${tripId}/passengers`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar pasajeros')
  renderPassengers(payload?.passengers || [])
}

async function loadSetup() {
  const [tripsRes, sessionRes] = await Promise.all([
    fetchWithAuth('/api/tickets/scanner/trips'),
    fetchWithAuth('/api/tickets/scanner/active-session'),
  ])

  const tripsPayload = await tripsRes.json().catch(() => ({}))
  const sessionPayload = await sessionRes.json().catch(() => ({}))

  if (!tripsRes.ok) throw new Error(tripsPayload?.error || 'No se pudo cargar viajes')
  if (!sessionRes.ok) throw new Error(sessionPayload?.error || 'No se pudo cargar sesión activa')

  renderActiveSession(sessionPayload?.session || null)
  renderTrips(tripsPayload?.trips || [])
  if (isAdmin && adminOperatorConfigEl && operatorSelectEl) {
    const operatorsRes = await fetchWithAuth('/api/tickets/scanner/operators')
    const operatorsPayload = await operatorsRes.json().catch(() => ({}))
    if (!operatorsRes.ok) throw new Error(operatorsPayload?.error || 'No se pudo cargar operadores')
    adminOperatorConfigEl.hidden = false
    renderOperators(operatorsPayload?.operators || [])
  }
  if (sessionPayload?.session?.tripId) {
    await loadPassengers(sessionPayload.session.tripId)
  } else {
    renderPassengers([])
  }
}

async function activateSession() {
  const tripId = Number(tripSelectEl.value || 0)
  if (!tripId) {
    setMessage('Selecciona un viaje antes de activar sesión.', 'error')
    return
  }

  const accessCode = String(accessCodeEl.value || '').trim().toUpperCase()
  const selectedOperatorUserId = Number(operatorSelectEl?.value || 0)
  const isOperatorAssignment = isAdmin && selectedOperatorUserId > 0

  const endpoint = isOperatorAssignment
    ? '/api/tickets/scanner/admin-start-session'
    : '/api/tickets/scanner/start-session'
  const requestPayload = isOperatorAssignment
    ? { operatorUserId: selectedOperatorUserId, tripId, accessCode: accessCode || undefined }
    : { tripId, accessCode: accessCode || undefined }

  const res = await fetchWithAuth(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestPayload),
  })
  const responsePayload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(responsePayload?.error || 'No se pudo activar sesión')

  renderActiveSession(responsePayload?.session || null)
  if (responsePayload?.session?.tripId) await loadPassengers(responsePayload.session.tripId)
  if (isOperatorAssignment) {
    const operatorName = responsePayload?.operator?.name || responsePayload?.operator?.email || `usuario ${selectedOperatorUserId}`
    setMessage(`Sesión activa asignada al operador ${operatorName}.`, 'ok')
  } else {
    setMessage('Sesión activa configurada correctamente.', 'ok')
  }
}

function showModal() {
  modal.hidden = false
}

function hideModal() {
  modal.hidden = true
}

function renderResult(payload) {
  const ticket = payload?.ticket || {}
  const passengers = Array.isArray(payload?.passengers) ? payload.passengers : []
  const route = [ticket.origin, ticket.destination].filter(Boolean).join(' → ') || '—'

  resultBody.innerHTML = `
    <div class="scan-grid">
      <div><strong>Nombre:</strong> ${ticket.passengerName || '—'}</div>
      <div><strong>DNI / ID:</strong> ${ticket.passengerIdentification || '—'}</div>
      <div><strong>Viaje:</strong> ${route}</div>
      <div><strong>Código ruta:</strong> ${ticket.routeCode || '—'}</div>
      <div><strong>Salida:</strong> ${fmtDate(ticket.departureAt)}</div>
      <div><strong>Llegada:</strong> ${fmtDate(ticket.arrivalAt)}</div>
      <div><strong>Referencia:</strong> ${ticket.referenceCode || '—'}</div>
      <div><strong>UUID:</strong> ${ticket.uuid || '—'}</div>
      <div><strong>Estado:</strong> ${ticket.status || 'USED'}</div>
      <div><strong>Teléfono:</strong> ${ticket.passengerPhone || '—'}</div>
    </div>
    <div class="scan-passengers">
      <h3>Pasajeros de la reserva</h3>
      ${passengers.length ? passengers.map((p, i) => `
        <article class="scan-passenger-item">
          <strong>${p.fullName || `Pasajero ${i + 1}`}</strong>
          <span>ID: ${p.identification || '—'}</span>
          <span>Tel: ${p.phone || '—'}</span>
        </article>
      `).join('') : '<p>Sin pasajeros adicionales.</p>'}
    </div>
  `
}

async function verifyQr(event) {
  event.preventDefault()
  const qrPayload = String(qrPayloadEl.value || '').trim()
  const presentedId = String(presentedIdEl.value || '').trim()

  if (!activeSession?.id || !activeSession?.tripId) {
    setMessage('Primero activa una sesión de viaje.', 'error')
    return
  }

  if (!qrPayload) {
    setMessage('Escanea o pega el contenido del QR.', 'error')
    return
  }

  try {
    scanBtn.setAttribute('disabled', 'true')
    setMessage('Validando billete...')

    const res = await fetchWithAuth('/api/tickets/verify-qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        qrPayload,
        presentedId: presentedId || undefined,
        tripId: Number(activeSession.tripId),
        scannerSessionId: Number(activeSession.id),
        accessCode: activeSession.accessCode,
      })
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      setMessage(payload?.error || 'No se pudo validar el billete.', 'error')
      return
    }

    renderResult(payload)
    showModal()
    await loadPassengers(Number(activeSession.tripId))
    setMessage('Billete validado correctamente.', 'ok')
    qrPayloadEl.value = ''
    presentedIdEl.value = ''
    qrPayloadEl.focus()
  } catch (e) {
    setMessage('Error de conexión al validar el QR.', 'error')
  } finally {
    scanBtn.removeAttribute('disabled')
  }
}

form?.addEventListener('submit', verifyQr)
activateSessionBtn?.addEventListener('click', async () => {
  try {
    activateSessionBtn.setAttribute('disabled', 'true')
    await activateSession()
  } catch (e) {
    setMessage(e?.message || 'No se pudo activar sesión.', 'error')
  } finally {
    activateSessionBtn.removeAttribute('disabled')
  }
})
refreshTripsBtn?.addEventListener('click', async () => {
  try {
    refreshTripsBtn.setAttribute('disabled', 'true')
    await loadSetup()
    setMessage('Viajes actualizados.', 'ok')
  } catch (e) {
    setMessage(e?.message || 'No se pudo actualizar viajes.', 'error')
  } finally {
    refreshTripsBtn.removeAttribute('disabled')
  }
})
clearBtn?.addEventListener('click', () => {
  qrPayloadEl.value = ''
  presentedIdEl.value = ''
  setMessage('')
  qrPayloadEl.focus()
})

closeModalBtn?.addEventListener('click', hideModal)
closeModalFooterBtn?.addEventListener('click', hideModal)
modal?.addEventListener('click', (e) => {
  if (e.target === modal) hideModal()
})

loadSetup().catch((e) => {
  setMessage(e?.message || 'No se pudo cargar configuración del escáner.', 'error')
})
