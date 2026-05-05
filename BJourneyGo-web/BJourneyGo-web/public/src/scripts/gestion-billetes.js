import { fetchWithAuth } from '/src/scripts/api.js'

// Gestion de Billetes - Integracion con API

const intranetAuth = localStorage.getItem('intranetAuth')
if (intranetAuth !== 'true') {
  location.replace('/intranet-login')
}

const role = localStorage.getItem('intranetRole') || 'admin'
const agencyName = localStorage.getItem('agencyName') || ''

if (role === 'scanner') {
  location.replace('/intranet/escaner-qr')
}

if (role === 'agency') {
  document.querySelector('.tickets-hero h1').textContent = 'Gestion de Billetes - ' + agencyName
  document.querySelector('.lead').textContent = 'Administra tus rutas, horarios, precios y disponibilidad de billetes.'
  const bulkEditBtn = document.getElementById('bulkEditBtn')
  if (bulkEditBtn) bulkEditBtn.style.display = 'none'
}

const storageKey = 'intranetRoutesLocal'
let apiRoutes = []
let apiTrips = []
let localRoutes = []
let filteredRoutes = []
let currentPage = 1
const itemsPerPage = 10
let currentView = 'table'

function parseNumberInput(value, fallback = 0) {
  if (value === null || value === undefined) return fallback
  const normalized = String(value).trim().replace(',', '.')
  if (!normalized) return fallback
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseDateLike(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value
  }
  const raw = String(value).trim()
  if (!raw) return null

  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (localMatch) {
    const year = Number(localMatch[1])
    const month = Number(localMatch[2])
    const day = Number(localMatch[3])
    const hour = Number(localMatch[4])
    const minute = Number(localMatch[5])
    const second = Number(localMatch[6] || '0')
    const d = new Date(year, month - 1, day, hour, minute, second)
    return Number.isNaN(d.getTime()) ? null : d
  }

  const parsed = new Date(raw)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function normalizeTripStatus(trip, now = new Date()) {
  const status = String(trip?.status || 'SCHEDULED').toUpperCase()
  if (status === 'CANCELLED' || status === 'COMPLETED') return status
  const arrivalDate = parseDateLike(trip?.arrivalAt)
  if (arrivalDate && arrivalDate.getTime() <= now.getTime()) return 'COMPLETED'
  return status
}

function tripStatusLabel(status) {
  return status === 'COMPLETED' ? 'Completado' : status === 'CANCELLED' ? 'Cancelado' : 'Programado'
}

function toInputDateTimeValue(date) {
  if (!date) return ''
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

function formatLocalDateKey(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function isLocalRoute(id) {
  return localRoutes.some(r => String(r.id) === String(id))
}

function loadLocalRoutes() {
  try {
    const raw = localStorage.getItem(storageKey)
    localRoutes = raw ? JSON.parse(raw) : []
  } catch (e) {
    localRoutes = []
  }
}

function saveLocalRoutes() {
  localStorage.setItem(storageKey, JSON.stringify(localRoutes))
}

async function fetchJson(url) {
  const res = await fetchWithAuth(url)
  if (!res.ok) throw new Error('request failed')
  return res.json()
}

async function loadData() {
  try {
    const [routesRes, tripsRes] = await Promise.all([
      fetchJson('/api/admin/routes'),
      fetchJson('/api/admin/trips')
    ])
    apiRoutes = routesRes.routes || []
    apiTrips = tripsRes.trips || []
  } catch (e) {
    apiRoutes = []
    apiTrips = []
  }

  loadLocalRoutes()
  const routesWithStats = buildRoutesWithStats()
  filteredRoutes = routesWithStats
  updateStats(routesWithStats)
  renderCurrentView()
  renderTrips()
  updatePagination()
  syncOverdueTrips().catch(() => {})
}

async function syncOverdueTrips() {
  const overdueTrips = apiTrips.filter(trip => {
    const storedStatus = String(trip.status || 'SCHEDULED').toUpperCase()
    return storedStatus !== 'CANCELLED' && storedStatus !== 'COMPLETED' && normalizeTripStatus(trip) === 'COMPLETED'
  })

  if (!overdueTrips.length) return

  await Promise.all(overdueTrips.map(async trip => {
    try {
      const res = await fetchWithAuth(`/api/admin/trips/${trip.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departureAt: trip.departureAt,
          arrivalAt: trip.arrivalAt,
          capacity: Number(trip.capacity || 0),
          basePrice: Number(trip.basePrice || 0),
          status: 'COMPLETED'
        })
      })
      if (!res.ok) throw new Error('auto complete failed')
    } catch (_error) {
      // Keep UI working even if background sync fails.
    }
  }))
}

function buildRoutesWithStats() {
  const merged = [...apiRoutes.map(r => ({
    id: r.id,
    code: r.code,
    origin: r.origin,
    destination: r.destination,
    type: 'standard',
    duration: Number(r.durationMinutes || 0),
    distance: Number(r.distanceKm || 0),
    status: String(r.status || 'ACTIVE').toLowerCase()
  })), ...localRoutes]

  return merged.map(route => {
    const trips = apiTrips.filter(t => String(t.routeId) === String(route.id))
    const capacity = trips.length
      ? trips.reduce((sum, t) => sum + (t.capacity || 0), 0)
      : Number(route.capacity || 0)
    const seatsSold = trips.reduce((sum, t) => sum + (t.seatsSold || 0), 0)
    const price = trips.length
      ? (trips.reduce((s, t) => s + Number(t.basePrice || 0), 0) / trips.length)
      : Number(route.price || 0)
    return { ...route, capacity, occupied: seatsSold, price }
  })
}

function updateStats(routes) {
  const active = routes.filter(r => r.status === 'active').length
  const today = formatLocalDateKey(new Date())
  const todaysTrips = apiTrips.filter(t => {
    const departure = parseDateLike(t.departureAt)
    return departure ? formatLocalDateKey(departure) === today : false
  })
  const availableTickets = routes.reduce((sum, r) => sum + Math.max(0, (r.capacity || 0) - (r.occupied || 0)), 0)
  const avgOcc = routes.length
    ? routes.reduce((sum, r) => sum + ((r.capacity || 0) ? (r.occupied / r.capacity) * 100 : 0), 0) / routes.length
    : 0

  document.getElementById('activeRoutes').textContent = String(active)
  document.getElementById('todaySchedules').textContent = String(todaysTrips.length)
  document.getElementById('availableTickets').textContent = String(availableTickets)
  document.getElementById('avgOccupancy').textContent = avgOcc.toFixed(1) + '%'
}

function pageSlice(list) {
  const start = (currentPage - 1) * itemsPerPage
  return list.slice(start, start + itemsPerPage)
}

function renderTable() {
  const tbody = document.getElementById('routesTableBody')
  const rows = pageSlice(filteredRoutes)
  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-muted);">No se encontraron rutas</td></tr>'
    return
  }
  tbody.innerHTML = rows.map(route => `
    <tr>
      <td><strong>${route.code}</strong></td>
      <td>${route.origin} → ${route.destination}</td>
      <td style="text-transform: capitalize;">${route.type}</td>
      <td>${Math.floor(route.duration / 60)}h ${route.duration % 60}min</td>
      <td>€${Number(route.price || 0).toFixed(2)}</td>
      <td>${route.occupied || 0}/${route.capacity || 0}</td>
      <td><span class="status-badge ${route.status}">${route.status === 'active' ? 'Activa' : route.status === 'inactive' ? 'Inactiva' : 'Mantenimiento'}</span></td>
      <td>
        <div class="action-icons">
          <button class="icon-btn edit-btn" data-id="${route.id}" title="Editar">✎</button>
          <button class="icon-btn delete-btn" data-id="${route.id}" title="Eliminar">🗑</button>
        </div>
      </td>
    </tr>
  `).join('')

  tbody.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  })
  tbody.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteRoute(btn.dataset.id))
  })
}

function renderGrid() {
  const container = document.getElementById('routesGridContainer')
  const rows = pageSlice(filteredRoutes)
  if (rows.length === 0) {
    container.innerHTML = '<p style="text-align: center; padding: 2rem; color: var(--text-muted); grid-column: 1/-1;">No se encontraron rutas</p>'
    return
  }
  container.innerHTML = rows.map(route => `
    <div class="route-card">
      <div class="route-card-header">
        <div class="route-code">${route.code}</div>
        <span class="status-badge ${route.status}">${route.status === 'active' ? 'Activa' : route.status === 'inactive' ? 'Inactiva' : 'Mant.'}</span>
      </div>
      <div class="route-card-body">
        <div class="route-info">${route.origin} → ${route.destination}</div>
        <div class="route-info">${Math.floor(route.duration / 60)}h ${route.duration % 60}min</div>
        <div class="route-info">${route.occupied || 0}/${route.capacity || 0} ocupados</div>
        <div class="route-price">€${Number(route.price || 0).toFixed(2)}</div>
        <div class="action-icons">
          <button class="icon-btn edit-btn" data-id="${route.id}">Editar</button>
          <button class="icon-btn delete-btn" data-id="${route.id}">Eliminar</button>
        </div>
      </div>
    </div>
  `).join('')

  container.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  })
  container.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteRoute(btn.dataset.id))
  })
}

function renderCurrentView() {
  if (currentView === 'grid') {
    document.getElementById('tableView').style.display = 'none'
    document.getElementById('gridView').style.display = 'block'
    renderGrid()
  } else {
    document.getElementById('tableView').style.display = 'block'
    document.getElementById('gridView').style.display = 'none'
    renderTable()
  }
}

function updatePagination() {
  const totalPages = Math.max(1, Math.ceil(filteredRoutes.length / itemsPerPage))
  document.getElementById('currentPage').textContent = String(currentPage)
  document.getElementById('totalPages').textContent = String(totalPages)
  document.getElementById('prevPage').disabled = currentPage === 1
  document.getElementById('nextPage').disabled = currentPage >= totalPages
}

function applyFilters() {
  const query = (document.getElementById('searchInput').value || '').toLowerCase()
  const status = document.getElementById('statusFilter').value
  const type = document.getElementById('typeFilter').value

  const routesWithStats = buildRoutesWithStats()
  filteredRoutes = routesWithStats.filter(route => {
    const matchQuery = !query || route.code.toLowerCase().includes(query) || route.origin.toLowerCase().includes(query) || route.destination.toLowerCase().includes(query)
    const matchStatus = status === 'all' || route.status === status
    const matchType = type === 'all' || route.type === type
    return matchQuery && matchStatus && matchType
  })

  currentPage = 1
  renderCurrentView()
  updatePagination()
}

// Modal and form handling
const modal = document.getElementById('routeModal')
const form = document.getElementById('routeForm')
const scheduleModal = document.getElementById('scheduleModal')
const scheduleForm = document.getElementById('scheduleForm')
const scheduleCreateReturn = document.getElementById('scheduleCreateReturn')
const returnTripFields = document.getElementById('returnTripFields')

function setDateTimeInputValue(inputEl, date) {
  if (!inputEl || !date || Number.isNaN(date.getTime())) return
  inputEl.value = toInputDateTimeValue(date)
}

function addMinutesToInput(inputId, minutes) {
  const input = document.getElementById(inputId)
  if (!input) return
  const base = parseDateLike(input.value) || new Date()
  const next = new Date(base.getTime() + minutes * 60000)
  setDateTimeInputValue(input, next)
}

function autoFillArrival({ routeSelectId, departureInputId, arrivalInputId }) {
  const routeSelect = document.getElementById(routeSelectId)
  const departureInput = document.getElementById(departureInputId)
  const arrivalInput = document.getElementById(arrivalInputId)
  if (!routeSelect || !departureInput || !arrivalInput) return

  const selectedOption = routeSelect.selectedOptions?.[0]
  const durationMinutes = Number(selectedOption?.dataset?.durationMinutes || 0)
  const departure = parseDateLike(departureInput.value)
  if (!departure || !durationMinutes || durationMinutes <= 0) return

  const arrival = new Date(departure.getTime() + durationMinutes * 60000)
  setDateTimeInputValue(arrivalInput, arrival)
}

function bindDateTimeControl(buttonId, handler) {
  const btn = document.getElementById(buttonId)
  btn?.addEventListener('click', (e) => {
    e.preventDefault()
    handler()
  })
}

function syncScheduleRoundtripUI() {
  const enabled = Boolean(scheduleCreateReturn?.checked)
  if (returnTripFields) returnTripFields.style.display = enabled ? 'block' : 'none'
  const returnRoute = document.getElementById('scheduleReturnRoute')
  const returnDeparture = document.getElementById('scheduleReturnDeparture')
  const returnArrival = document.getElementById('scheduleReturnArrival')
  const returnPrice = document.getElementById('scheduleReturnPrice')
  if (returnRoute) returnRoute.required = enabled
  if (returnDeparture) returnDeparture.required = enabled
  if (returnArrival) returnArrival.required = enabled
  if (!enabled) {
    if (returnRoute) returnRoute.value = ''
    if (returnDeparture) returnDeparture.value = ''
    if (returnArrival) returnArrival.value = ''
    if (returnPrice) returnPrice.value = ''
  }
}

scheduleCreateReturn?.addEventListener('change', syncScheduleRoundtripUI)

function openModal(title) {
  document.getElementById('modalTitle').textContent = title
  modal.classList.add('active')
}

function closeModal() {
  modal.classList.remove('active')
  delete form.dataset.editId
}

function openEditModal(id) {
  const route = filteredRoutes.find(r => String(r.id) === String(id))
  if (!route) return
  document.getElementById('routeCode').value = route.code
  document.getElementById('origin').value = route.origin
  document.getElementById('destination').value = route.destination
  document.getElementById('routeType').value = route.type
  document.getElementById('duration').value = route.duration
  document.getElementById('price').value = Number(route.price || 0)
  document.getElementById('capacity').value = route.capacity || 0
  document.getElementById('distance').value = route.distance || 0
  document.getElementById('status').value = route.status || 'active'
  form.dataset.editId = route.id
  openModal('Editar ruta')
}

async function deleteRoute(id) {
  if (!confirm('¿Estas seguro de que quieres eliminar esta ruta?')) return
  if (isLocalRoute(id)) {
    localRoutes = localRoutes.filter(r => String(r.id) !== String(id))
    saveLocalRoutes()
    loadData()
    return
  }
  try {
    const res = await fetchWithAuth(`/api/admin/routes/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('delete failed')
    loadData()
  } catch (e) {
    alert('No se pudo eliminar la ruta')
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault()
  const editId = form.dataset.editId
  const statusMap = {
    active: 'ACTIVE',
    inactive: 'INACTIVE',
    maintenance: 'INACTIVE'
  }
  const code = document.getElementById('routeCode').value.trim()
  const origin = document.getElementById('origin').value.trim()
  const destination = document.getElementById('destination').value.trim()
  if (!code || !origin || !destination) {
    alert('Codigo, origen y destino son obligatorios')
    return
  }
  const payload = {
    code,
    origin,
    destination,
    type: document.getElementById('routeType').value,
    duration: parseNumberInput(document.getElementById('duration').value, 0),
    distance: parseNumberInput(document.getElementById('distance').value, 0),
    price: parseNumberInput(document.getElementById('price').value, 0),
    capacity: parseNumberInput(document.getElementById('capacity').value, 0),
    status: document.getElementById('status').value || 'active'
  }
  try {
    if (editId) {
      if (isLocalRoute(editId)) {
        localRoutes = localRoutes.map(r => String(r.id) === String(editId) ? { ...r, ...payload } : r)
        saveLocalRoutes()
      } else {
        const res = await fetchWithAuth(`/api/admin/routes/${editId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: payload.code,
            origin: payload.origin,
            destination: payload.destination,
            distanceKm: payload.distance || null,
            durationMinutes: payload.duration || null,
            basePrice: payload.price,
            status: statusMap[payload.status] || 'ACTIVE'
          })
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error(err.error || 'update failed')
        }
      }
    } else {
      const res = await fetchWithAuth('/api/admin/routes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: payload.code,
          origin: payload.origin,
          destination: payload.destination,
          distanceKm: payload.distance || null,
          durationMinutes: payload.duration || null,
          status: statusMap[payload.status] || 'ACTIVE'
        })
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'create failed')
      }
      const created = await res.json()
      const createdRouteId = created?.id
      if (createdRouteId) {
        await openScheduleModalForRoute(createdRouteId, payload.capacity, payload.price)
      }
    }
    closeModal()
    form.reset()
    delete form.dataset.editId
    loadData()
  } catch (e) {
    if (!editId && e && e.name === 'TypeError') {
      payload.id = String(Date.now())
      localRoutes.push(payload)
      saveLocalRoutes()
      closeModal()
      form.reset()
      delete form.dataset.editId
      loadData()
      return
    }
    alert(e?.message || 'No se pudo guardar la ruta')
  }
})

// UI bindings

document.getElementById('createRouteBtn').addEventListener('click', () => {
  form.reset()
  delete form.dataset.editId
  openModal('Nueva ruta')
})

document.getElementById('closeModal').addEventListener('click', closeModal)

document.getElementById('cancelBtn').addEventListener('click', closeModal)

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal()
})

const createScheduleBtn = document.getElementById('createScheduleBtn')
createScheduleBtn?.addEventListener('click', async () => {
  await populateScheduleOptions()
  scheduleForm.reset()
  delete scheduleForm.dataset.editId
  document.getElementById('scheduleRoute').disabled = false
  scheduleModal.classList.add('active')
})

bindDateTimeControl('scheduleDeparturePlus15', () => addMinutesToInput('scheduleDeparture', 15))
bindDateTimeControl('scheduleDeparturePlus30', () => addMinutesToInput('scheduleDeparture', 30))
bindDateTimeControl('scheduleDeparturePlus60', () => addMinutesToInput('scheduleDeparture', 60))
bindDateTimeControl('scheduleReturnDeparturePlus15', () => addMinutesToInput('scheduleReturnDeparture', 15))
bindDateTimeControl('scheduleReturnDeparturePlus30', () => addMinutesToInput('scheduleReturnDeparture', 30))
bindDateTimeControl('scheduleReturnDeparturePlus60', () => addMinutesToInput('scheduleReturnDeparture', 60))
bindDateTimeControl('scheduleAutoArrivalBtn', () => autoFillArrival({
  routeSelectId: 'scheduleRoute',
  departureInputId: 'scheduleDeparture',
  arrivalInputId: 'scheduleArrival'
}))
bindDateTimeControl('scheduleAutoReturnArrivalBtn', () => autoFillArrival({
  routeSelectId: 'scheduleReturnRoute',
  departureInputId: 'scheduleReturnDeparture',
  arrivalInputId: 'scheduleReturnArrival'
}))

document.getElementById('scheduleRoute')?.addEventListener('change', () => autoFillArrival({
  routeSelectId: 'scheduleRoute',
  departureInputId: 'scheduleDeparture',
  arrivalInputId: 'scheduleArrival'
}))
document.getElementById('scheduleDeparture')?.addEventListener('change', () => autoFillArrival({
  routeSelectId: 'scheduleRoute',
  departureInputId: 'scheduleDeparture',
  arrivalInputId: 'scheduleArrival'
}))
document.getElementById('scheduleReturnRoute')?.addEventListener('change', () => autoFillArrival({
  routeSelectId: 'scheduleReturnRoute',
  departureInputId: 'scheduleReturnDeparture',
  arrivalInputId: 'scheduleReturnArrival'
}))
document.getElementById('scheduleReturnDeparture')?.addEventListener('change', () => autoFillArrival({
  routeSelectId: 'scheduleReturnRoute',
  departureInputId: 'scheduleReturnDeparture',
  arrivalInputId: 'scheduleReturnArrival'
}))

function closeScheduleModal() {
  scheduleModal.classList.remove('active')
  scheduleForm.reset()
  delete scheduleForm.dataset.editId
  document.getElementById('scheduleRoute').disabled = false
  if (scheduleCreateReturn) scheduleCreateReturn.checked = false
  syncScheduleRoundtripUI()
}

document.getElementById('closeScheduleModal')?.addEventListener('click', closeScheduleModal)
document.getElementById('cancelScheduleBtn')?.addEventListener('click', closeScheduleModal)
scheduleModal?.addEventListener('click', (e) => { if (e.target === scheduleModal) closeScheduleModal() })

async function populateScheduleOptions() {
  const routeSelect = document.getElementById('scheduleRoute')
  const returnRouteSelect = document.getElementById('scheduleReturnRoute')
  routeSelect.innerHTML = ''
  if (returnRouteSelect) returnRouteSelect.innerHTML = ''
  const placeholder = document.createElement('option')
  placeholder.value = ''
  placeholder.textContent = 'Selecciona una ruta'
  routeSelect.appendChild(placeholder)
  if (returnRouteSelect) {
    const returnPlaceholder = document.createElement('option')
    returnPlaceholder.value = ''
    returnPlaceholder.textContent = 'Selecciona una ruta de vuelta'
    returnRouteSelect.appendChild(returnPlaceholder)
  }
  try {
    const routesRes = await fetchWithAuth('/api/admin/routes')
    const routesJson = await routesRes.json()
    const routes = routesJson.routes || []
    if (!routes.length) {
      const emptyOpt = document.createElement('option')
      emptyOpt.value = ''
      emptyOpt.textContent = 'No hay rutas disponibles'
      emptyOpt.disabled = true
      emptyOpt.selected = true
      routeSelect.innerHTML = ''
      routeSelect.appendChild(emptyOpt)
      return
    }
    routes.forEach(r => {
      const opt = document.createElement('option')
      opt.value = r.id
      opt.textContent = `${r.code} ${r.origin} → ${r.destination}`
      opt.dataset.durationMinutes = String(Number(r.durationMinutes || 0))
      routeSelect.appendChild(opt)
      if (returnRouteSelect) {
        const returnOpt = document.createElement('option')
        returnOpt.value = r.id
        returnOpt.textContent = `${r.code} ${r.origin} → ${r.destination}`
        returnOpt.dataset.durationMinutes = String(Number(r.durationMinutes || 0))
        returnRouteSelect.appendChild(returnOpt)
      }
    })
  } catch (e) {
    const errorOpt = document.createElement('option')
    errorOpt.value = ''
    errorOpt.textContent = 'No se pudieron cargar rutas'
    errorOpt.disabled = true
    errorOpt.selected = true
    routeSelect.innerHTML = ''
    routeSelect.appendChild(errorOpt)
  }
}

async function openScheduleModalForRoute(routeId, capacity, price) {
  await populateScheduleOptions()
  scheduleForm.reset()
  delete scheduleForm.dataset.editId
  const routeSelect = document.getElementById('scheduleRoute')
  routeSelect.value = String(routeId)
  routeSelect.disabled = true
  document.getElementById('scheduleCapacity').value = capacity || ''
  document.getElementById('schedulePrice').value = price || ''
  if (scheduleCreateReturn) scheduleCreateReturn.checked = false
  syncScheduleRoundtripUI()
  scheduleModal.classList.add('active')
}

scheduleForm?.addEventListener('submit', async (e) => {
  e.preventDefault()
  const editId = scheduleForm.dataset.editId
  const routeValue = document.getElementById('scheduleRoute').value
  if (!routeValue) {
    alert('Selecciona una ruta valida')
    return
  }
  const payload = {
    routeId: Number(routeValue),
    departureAt: document.getElementById('scheduleDeparture').value,
    arrivalAt: document.getElementById('scheduleArrival').value,
    capacity: parseNumberInput(document.getElementById('scheduleCapacity').value, 0),
    basePrice: parseNumberInput(document.getElementById('schedulePrice').value, 0),
    status: document.getElementById('scheduleStatus').value || 'SCHEDULED'
  }
  if (!payload.departureAt || !payload.arrivalAt) {
    alert('Debes indicar hora de salida y llegada')
    return
  }
  const departureDate = parseDateLike(payload.departureAt)
  const arrivalDate = parseDateLike(payload.arrivalAt)
  if (!departureDate || !arrivalDate) {
    alert('Formato de fecha/hora invalido')
    return
  }
  if (arrivalDate.getTime() <= departureDate.getTime()) {
    alert('La hora de llegada debe ser posterior a la de salida')
    return
  }

  const selectedStatus = String(payload.status || 'SCHEDULED').toUpperCase()
  payload.status = selectedStatus === 'CANCELLED' ? 'CANCELLED' : (arrivalDate.getTime() <= Date.now() ? 'COMPLETED' : selectedStatus)

  const createReturn = Boolean(scheduleCreateReturn?.checked)
  const returnPayload = {
    routeId: Number(document.getElementById('scheduleReturnRoute')?.value || 0),
    departureAt: document.getElementById('scheduleReturnDeparture')?.value || '',
    arrivalAt: document.getElementById('scheduleReturnArrival')?.value || '',
    capacity: payload.capacity,
    basePrice: parseNumberInput(document.getElementById('scheduleReturnPrice')?.value, payload.basePrice),
    status: payload.status
  }
  if (createReturn) {
    if (!returnPayload.routeId || !returnPayload.departureAt || !returnPayload.arrivalAt) {
      alert('Debes completar los datos del viaje de vuelta')
      return
    }
    const returnDepartureDate = parseDateLike(returnPayload.departureAt)
    const returnArrivalDate = parseDateLike(returnPayload.arrivalAt)
    if (!returnDepartureDate || !returnArrivalDate) {
      alert('Formato de fecha/hora inválido para la vuelta')
      return
    }
    if (returnArrivalDate.getTime() <= returnDepartureDate.getTime()) {
      alert('La llegada de la vuelta debe ser posterior a su salida')
      return
    }
    const returnStatus = String(returnPayload.status || 'SCHEDULED').toUpperCase()
    returnPayload.status = returnStatus === 'CANCELLED' ? 'CANCELLED' : (returnArrivalDate.getTime() <= Date.now() ? 'COMPLETED' : returnStatus)
  }
  try {
    if (editId) {
      const res = await fetchWithAuth(`/api/admin/trips/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          departureAt: payload.departureAt,
          arrivalAt: payload.arrivalAt,
          capacity: payload.capacity,
          basePrice: payload.basePrice,
          status: payload.status
        })
      })
      if (!res.ok) throw new Error('update trip failed')
    } else {
      if (createReturn) {
        const outboundRes = await fetchWithAuth('/api/admin/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const outboundJson = await outboundRes.json().catch(() => ({}))
        if (!outboundRes.ok) {
          throw new Error(outboundJson?.error || 'create outbound trip failed')
        }

        let createdOutboundId = Number(outboundJson?.id || 0)
        const returnRes = await fetchWithAuth('/api/admin/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(returnPayload)
        })
        const returnJson = await returnRes.json().catch(() => ({}))
        if (!returnRes.ok) {
          if (createdOutboundId) {
            try {
              await fetchWithAuth(`/api/admin/trips/${createdOutboundId}`, { method: 'DELETE' })
            } catch (_rollbackError) {
              // Ignore rollback errors and show original failure reason.
            }
          }
          throw new Error(returnJson?.error || 'create return trip failed')
        }
      } else {
        const res = await fetchWithAuth('/api/admin/trips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || 'create trip failed')
      }
    }
    scheduleModal.classList.remove('active')
    scheduleForm.reset()
    delete scheduleForm.dataset.editId
    document.getElementById('scheduleRoute').disabled = false
    if (scheduleCreateReturn) scheduleCreateReturn.checked = false
    syncScheduleRoundtripUI()
    loadData()
  } catch (e) {
    alert(e?.message || 'No se pudo guardar el horario')
  }
})

function formatDateTime(value) {
  const d = parseDateLike(value)
  if (!d) return '-'
  return d.toLocaleString('es-ES', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function toInputDateTime(value) {
  const d = parseDateLike(value)
  return toInputDateTimeValue(d)
}

function renderTrips() {
  const tbody = document.getElementById('tripsTableBody')
  if (!tbody) return
  if (!apiTrips.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-muted);">No hay horarios</td></tr>'
    return
  }

  tbody.innerHTML = apiTrips.map(trip => {
    const status = normalizeTripStatus(trip)
    const statusLabel = tripStatusLabel(status)
    const badgeClass = status.toLowerCase()
    const occupancy = `${trip.seatsSold || 0}/${trip.capacity || 0}`
    return `
      <tr>
        <td>${trip.routeCode || ''} ${trip.origin || ''} → ${trip.destination || ''}</td>
        <td>${formatDateTime(trip.departureAt)}</td>
        <td>${formatDateTime(trip.arrivalAt)}</td>
        <td>€${Number(trip.basePrice || 0).toFixed(2)}</td>
        <td>${occupancy}</td>
        <td><span class="status-badge ${badgeClass}">${statusLabel}</span></td>
        <td>
          <div class="action-icons">
            <button class="icon-btn trip-edit-btn" data-id="${trip.id}" title="Editar">✎</button>
            <button class="icon-btn trip-delete-btn" data-id="${trip.id}" title="Eliminar">🗑</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  tbody.querySelectorAll('.trip-edit-btn').forEach(btn => {
    btn.addEventListener('click', () => openEditTripModal(btn.dataset.id))
  })
  tbody.querySelectorAll('.trip-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => deleteTrip(btn.dataset.id))
  })
}

async function openEditTripModal(id) {
  const trip = apiTrips.find(t => String(t.id) === String(id))
  if (!trip) return
  await populateScheduleOptions()
  document.getElementById('scheduleRoute').value = trip.routeId
  document.getElementById('scheduleRoute').disabled = true
  document.getElementById('scheduleDeparture').value = toInputDateTime(trip.departureAt)
  document.getElementById('scheduleArrival').value = toInputDateTime(trip.arrivalAt)
  document.getElementById('scheduleCapacity').value = trip.capacity || 0
  document.getElementById('schedulePrice').value = Number(trip.basePrice || 0)
  document.getElementById('scheduleStatus').value = normalizeTripStatus(trip)
  scheduleForm.dataset.editId = trip.id
  scheduleModal.classList.add('active')
}

async function deleteTrip(id) {
  if (!confirm('¿Estas seguro de que quieres eliminar este horario?')) return
  try {
    const res = await fetchWithAuth(`/api/admin/trips/${id}`, {
      method: 'DELETE'
    })
    if (!res.ok) throw new Error('delete trip failed')
    loadData()
  } catch (e) {
    alert('No se pudo eliminar el horario')
  }
}

// View switcher

document.querySelectorAll('.view-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'))
    btn.classList.add('active')
    currentView = btn.dataset.view
    renderCurrentView()
  })
})

// Search and filters

document.getElementById('searchInput').addEventListener('input', applyFilters)

document.getElementById('statusFilter').addEventListener('change', applyFilters)

document.getElementById('typeFilter').addEventListener('change', applyFilters)

document.getElementById('clearFiltersBtn').addEventListener('click', () => {
  document.getElementById('searchInput').value = ''
  document.getElementById('statusFilter').value = 'all'
  document.getElementById('typeFilter').value = 'all'
  applyFilters()
})

// Pagination

document.getElementById('prevPage').addEventListener('click', () => {
  if (currentPage > 1) {
    currentPage--
    renderCurrentView()
    updatePagination()
  }
})

document.getElementById('nextPage').addEventListener('click', () => {
  const totalPages = Math.ceil(filteredRoutes.length / itemsPerPage)
  if (currentPage < totalPages) {
    currentPage++
    renderCurrentView()
    updatePagination()
  }
})

// Init
syncScheduleRoundtripUI()
loadData()
setInterval(() => {
  loadData().catch(() => {})
}, 60000)
