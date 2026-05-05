import { fetchWithAuth } from '/src/scripts/api.js'

const operatorSelectEl = document.getElementById('operatorSelect')
const reloadBtn = document.getElementById('reloadBtn')
const tripListEl = document.getElementById('tripList')
const saveBtn = document.getElementById('saveBtn')
const selectAllBtn = document.getElementById('selectAllBtn')
const clearAllBtn = document.getElementById('clearAllBtn')
const statusEl = document.getElementById('status')

let operators = []
let trips = []
let selectedTripIds = new Set()

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
    minute: '2-digit',
  })
}

function setStatus(text, kind = '') {
  statusEl.textContent = text || ''
  statusEl.className = `status ${kind}`.trim()
}

function renderOperators() {
  operatorSelectEl.innerHTML = '<option value="">Selecciona operador...</option>'
  operators.forEach((op) => {
    const option = document.createElement('option')
    option.value = String(op.userId)
    option.textContent = `${op.name || op.email || `Usuario ${op.userId}`} • ${op.agencyName || 'Sin agencia'}`
    operatorSelectEl.appendChild(option)
  })
}

function renderTrips() {
  if (!trips.length) {
    tripListEl.innerHTML = '<p class="hint">No hay viajes disponibles para tu ámbito.</p>'
    return
  }

  tripListEl.innerHTML = trips.map((trip) => {
    const checked = selectedTripIds.has(Number(trip.id)) ? 'checked' : ''
    return `
      <label class="trip-item">
        <input type="checkbox" data-trip-id="${trip.id}" ${checked} />
        <div class="meta">
          <strong>#${trip.id} • ${trip.origin || '—'} → ${trip.destination || '—'}</strong>
          <span>${trip.routeCode || 'Sin código'} • Salida: ${fmtDate(trip.departureAt)}</span>
          <span>Agencia: ${trip.agencyName || '—'}</span>
        </div>
      </label>
    `
  }).join('')

  tripListEl.querySelectorAll('input[type="checkbox"]').forEach((el) => {
    el.addEventListener('change', () => {
      const id = Number(el.getAttribute('data-trip-id'))
      if (!id) return
      if (el.checked) selectedTripIds.add(id)
      else selectedTripIds.delete(id)
    })
  })
}

async function loadOperators() {
  const res = await fetchWithAuth('/api/tickets/scanner/operators')
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar operadores')
  operators = Array.isArray(payload?.operators) ? payload.operators : []
  renderOperators()
}

async function loadTrips() {
  const res = await fetchWithAuth('/api/tickets/scanner/trips')
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar viajes')
  trips = Array.isArray(payload?.trips) ? payload.trips : []
  renderTrips()
}

async function loadOperatorAccess(operatorUserId) {
  if (!operatorUserId) {
    selectedTripIds = new Set()
    renderTrips()
    return
  }
  const qs = new URLSearchParams({ operatorUserId: String(operatorUserId) }).toString()
  const res = await fetchWithAuth(`/api/tickets/scanner/operator-access?${qs}`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(payload?.error || 'No se pudo cargar accesos')
  selectedTripIds = new Set((payload?.access || []).map((r) => Number(r.tripId)).filter((n) => Number.isFinite(n) && n > 0))
  renderTrips()
}

async function bootstrap() {
  setStatus('Cargando configuración...')
  try {
    await Promise.all([loadOperators(), loadTrips()])
    setStatus('Configuración lista.', 'ok')
  } catch (e) {
    setStatus(e?.message || 'No se pudo cargar la configuración.', 'error')
  }
}

operatorSelectEl?.addEventListener('change', async () => {
  const operatorUserId = Number(operatorSelectEl.value || 0)
  setStatus('Cargando accesos del operador...')
  try {
    await loadOperatorAccess(operatorUserId)
    setStatus(operatorUserId ? 'Accesos cargados.' : 'Selecciona un operador para editar accesos.', 'ok')
  } catch (e) {
    setStatus(e?.message || 'No se pudo cargar accesos.', 'error')
  }
})

reloadBtn?.addEventListener('click', async () => {
  await bootstrap()
})

selectAllBtn?.addEventListener('click', () => {
  selectedTripIds = new Set(trips.map((t) => Number(t.id)).filter((n) => Number.isFinite(n) && n > 0))
  renderTrips()
  setStatus('Viajes visibles seleccionados.', 'ok')
})

clearAllBtn?.addEventListener('click', () => {
  selectedTripIds = new Set()
  renderTrips()
  setStatus('Selección limpiada.', 'ok')
})

saveBtn?.addEventListener('click', async () => {
  const operatorUserId = Number(operatorSelectEl?.value || 0)
  if (!operatorUserId) {
    setStatus('Selecciona un operador antes de guardar.', 'error')
    return
  }

  try {
    saveBtn.setAttribute('disabled', 'true')
    setStatus('Guardando permisos...')

    const res = await fetchWithAuth('/api/tickets/scanner/operator-access', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operatorUserId, tripIds: Array.from(selectedTripIds) }),
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || 'No se pudo guardar')

    setStatus('Permisos guardados correctamente.', 'ok')
  } catch (e) {
    setStatus(e?.message || 'No se pudo guardar permisos.', 'error')
  } finally {
    saveBtn.removeAttribute('disabled')
  }
})

bootstrap().catch(() => {})
