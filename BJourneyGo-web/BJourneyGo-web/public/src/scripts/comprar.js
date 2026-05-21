import { getToken } from '/src/scripts/api.js'

let apiTickets = []

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

const ticketsGrid = document.getElementById('ticketsGrid');
const noResults = document.getElementById('noResults');
const resultsHeader = document.getElementById('resultsHeader');
const resultsPanel = document.getElementById('resultsPanel');
const detailsModal = document.getElementById('detailsModal');
const modalCloseBtn = document.getElementById('modalCloseBtn');
const modalRoute = document.getElementById('modalRoute');
const modalRouteCode = document.getElementById('modalRouteCode');
const modalTime = document.getElementById('modalTime');
const modalArrival = document.getElementById('modalArrival');
const modalDuration = document.getElementById('modalDuration');
const modalPrice = document.getElementById('modalPrice');
const modalSeats = document.getElementById('modalSeats');
const modalDesc = document.getElementById('modalDesc');
const modalActionCloseBtn = document.getElementById('modalActionCloseBtn');
const modalChooseBtn = document.getElementById('modalChooseBtn');
const tripTypeEl = document.getElementById('tripType');
const startDateInput = document.getElementById('date');
const endDateInput = document.getElementById('endDate');

let tripIndex = new Map();
let selectedTripId = null;
let hasSearched = false;
let bookingType = 'ONEWAY'
let selectingLeg = 'outbound'
let selectedOutboundTrip = null

function getPassengerCount() {
  const raw = document.getElementById('passengers')?.value || '1'
  const count = parseInt(raw, 10)
  if (!Number.isFinite(count) || count <= 0) return 1
  return count
}

function syncDateBounds() {
  const startDate = String(startDateInput?.value || '')
  const endDate = String(endDateInput?.value || '')

  if (endDateInput) {
    endDateInput.min = startDate || ''
    if (startDate && (!endDate || endDate < startDate)) {
      endDateInput.value = startDate
    }
  }
}

function openPassengerInfo(tripId, triggerBtn, returnTripId = null) {
  const t = tripIndex.get(String(tripId)) || selectedOutboundTrip
  if (!t) return
  const quantity = getPassengerCount()
  if (quantity > Number(t.seats || 0)) {
    alert('La cantidad de personas supera las plazas disponibles para este viaje')
    return
  }
  if (triggerBtn) triggerBtn.setAttribute('disabled', 'true')
  if (returnTripId && selectedOutboundTrip) {
    const ret = tripIndex.get(String(returnTripId))
    if (!ret) return
    const roundtripParams = new URLSearchParams({
      bookingType: 'ROUNDTRIP',
      outboundTripId: String(selectedOutboundTrip.id),
      returnTripId: String(ret.id),
      quantity: String(quantity),
      outboundFrom: selectedOutboundTrip.from || '',
      outboundTo: selectedOutboundTrip.to || '',
      outboundDepartureAt: String(selectedOutboundTrip.datetime || ''),
      outboundUnitPrice: String(Number(selectedOutboundTrip.price || 0)),
      outboundRouteCode: selectedOutboundTrip.routeCode || '',
      returnFrom: ret.from || '',
      returnTo: ret.to || '',
      returnDepartureAt: String(ret.datetime || ''),
      returnUnitPrice: String(Number(ret.price || 0)),
      returnRouteCode: ret.routeCode || '',
      seats: String(Math.min(Number(selectedOutboundTrip.seats || 0), Number(ret.seats || 0)))
    })
    location.href = `/comprar-pasajeros?${roundtripParams.toString()}`
    return
  }

  const params = new URLSearchParams({
    bookingType: 'ONEWAY',
    tripId: String(tripId),
    quantity: String(quantity),
    from: t.from || '',
    to: t.to || '',
    departureAt: String(t.datetime || ''),
    unitPrice: String(Number(t.price || 0)),
    seats: String(Number(t.seats || 0)),
    routeCode: t.routeCode || ''
  })
  location.href = `/comprar-pasajeros?${params.toString()}`
}

function formatDateTime(dt) {
  try {
    const d = parseLocalDateTime(dt);
    return d.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}) + ' · ' + d.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'});
  } catch(e) {
    return dt;
  }
}

function renderTickets(tickets) {
  ticketsGrid.innerHTML = '';
  tripIndex = new Map();
  const passengerCount = getPassengerCount()
  if (!tickets || tickets.length === 0) {
    noResults.style.display = 'block';
    if (resultsHeader) resultsHeader.textContent = '';
    return;
  }
  noResults.style.display = 'none';
  if (resultsHeader) {
    const subtitle = bookingType === 'ROUNDTRIP'
      ? (selectingLeg === 'outbound' ? 'Selecciona primero la ida' : 'Ahora selecciona el viaje de vuelta')
      : 'Selecciona la mejor opción para tu ruta'
    resultsHeader.innerHTML = `<div class="results-title">${tickets.length} viajes disponibles</div><div class="results-subtitle">${subtitle}</div>`;
  }
  tickets.forEach(t => {
    tripIndex.set(String(t.id), t);
    const tags = []
    if (t.price <= 15) tags.push('<span class="tag tag--deal">Mejor precio</span>')
    if (t.seats <= 5) tags.push('<span class="tag tag--warn">Ultimas plazas</span>')
    if (t.seats >= 30) tags.push('<span class="tag tag--ok">Alta disponibilidad</span>')

    const article = document.createElement('article');
    article.className = 'ticket-card';

    const hasSeatsForGroup = Number(t.seats || 0) >= passengerCount
    const totalPrice = Number(t.price || 0) * passengerCount
    article.innerHTML = `
      <div class="trip-main">
        <div class="trip-route">
          <span class="city">${t.from}</span>
          <span class="arrow">→</span>
          <span class="city">${t.to}</span>
        </div>
        <div class="trip-tags">${tags.join('')}</div>
        <div class="trip-meta">
          <span class="chip">Directo</span>
          <span class="meta">Salida: ${formatDateTime(t.datetime)}</span>
          <span class="meta">Llegada: ${formatDateTime(t.arrivalAt)}</span>
          <span class="meta">Duración: ${t.duration || '—'}</span>
        </div>
        <p class="trip-desc">${t.desc || ''}</p>
      </div>
      <div class="trip-side">
        <div class="price">€${t.price.toFixed(2)} <span class="price-suffix">/ persona</span></div>
        <div class="price-total">Total: €${totalPrice.toFixed(2)} (${passengerCount} ${passengerCount === 1 ? 'persona' : 'personas'})</div>
        <div class="seats">${t.seats} plazas</div>
        <button class="btn btn--primary btn-buy" data-id="${t.id}" ${hasSeatsForGroup ? '' : 'aria-disabled="true"'}>${hasSeatsForGroup ? (bookingType === 'ROUNDTRIP' ? (selectingLeg === 'outbound' ? 'Elegir ida' : 'Elegir vuelta') : 'Continuar compra') : 'Sin cupo'}</button>
      </div>
    `;

    ticketsGrid.appendChild(article);
  });

  ticketsGrid.querySelectorAll('.btn-buy').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id') || ''
      if (!id) return
      if (bookingType === 'ROUNDTRIP' && selectingLeg === 'outbound') {
        const from = document.getElementById('from').value.trim()
        const to = document.getElementById('to').value.trim()
        selectedOutboundTrip = tripIndex.get(String(id)) || null
        if (!selectedOutboundTrip) return

        try {
          btn.setAttribute('disabled', 'true')
          apiTickets = await fetchTrips({
            origin: to,
            destination: from
          })
          selectingLeg = 'return'
          hasSearched = true
          applyClientFilters()
        } catch (err) {
          const message = err instanceof Error ? err.message : 'No se pudieron cargar viajes de vuelta'
          alert(message)
        } finally {
          btn.removeAttribute('disabled')
        }
        return
      }

      if (bookingType === 'ROUNDTRIP' && selectingLeg === 'return') {
        openPassengerInfo(Number(selectedOutboundTrip?.id || 0), btn, Number(id))
        return
      }

      openPassengerInfo(Number(id), btn)
    })
  })
}

function normalizeTrips(rows) {
  return (rows || []).map(t => {
    const seatsLeft = Math.max(0, (t.capacity || 0) - (t.seatsSold || 0))
    let duration = ''
    if (t.departureAt && t.arrivalAt) {
      const ms = parseLocalDateTime(t.arrivalAt).getTime() - parseLocalDateTime(t.departureAt).getTime()
      if (ms > 0) {
        const mins = Math.round(ms / 60000)
        const h = Math.floor(mins / 60)
        const m = mins % 60
        duration = `${h}h ${m}m`
      }
    }
    const departureDate = parseLocalDateTime(t.departureAt)
    const timeStr = departureDate.toLocaleTimeString(undefined, {hour:'2-digit', minute:'2-digit'})
    return {
      id: t.id,
      from: t.origin,
      to: t.destination,
      price: Number(t.basePrice || 0),
      datetime: t.departureAt,
      duration,
      seats: seatsLeft,
      desc: `Salida ${timeStr} · Ruta ${t.routeCode || ''}`.trim(),
      routeCode: t.routeCode || '',
      arrivalAt: t.arrivalAt
    }
  })
}

async function fetchTrips(params = {}) {
  const qs = new URLSearchParams(params).toString()
  const res = await fetch(`/api/trips${qs ? `?${qs}` : ''}`)
  if (!res.ok) {
    let message = 'Failed to load trips'
    try {
      const payload = await res.json()
      if (payload?.error) message = payload.error
    } catch (_e) {}
    throw new Error(message)
  }
  const json = await res.json()
  return normalizeTrips(json.trips || [])
}

if (resultsPanel) resultsPanel.classList.add('is-hidden')

const form = document.getElementById('searchForm');

function syncTripTypeUI() {
  bookingType = String(tripTypeEl?.value || 'ONEWAY').toUpperCase()
}

tripTypeEl?.addEventListener('change', syncTripTypeUI)
syncTripTypeUI()

function applyClientFilters() {
  if (!hasSearched) return;

  const passengers = getPassengerCount();
  const minPriceVal = document.getElementById('filterMinPrice')?.value || ''
  const maxPriceFilterVal = document.getElementById('filterMaxPrice')?.value || ''
  const minPrice = minPriceVal ? parseFloat(minPriceVal) : 0
  const maxPriceFilter = maxPriceFilterVal ? parseFloat(maxPriceFilterVal) : Infinity
  const seatsMinVal = document.getElementById('filterSeats')?.value || ''
  const seatsMin = seatsMinVal ? parseInt(seatsMinVal, 10) : 0
  const timeFrom = document.getElementById('filterTimeFrom')?.value || ''
  const timeTo = document.getElementById('filterTimeTo')?.value || ''
  const sortBy = document.getElementById('sortBy')?.value || 'recommend'

  if (resultsPanel) resultsPanel.classList.remove('is-hidden')

  const filtered = apiTickets.filter(t => {
    if (t.price < minPrice) return false;
    if (t.price > maxPriceFilter) return false;
    if (t.seats < seatsMin) return false;
    if (t.seats < passengers) return false;
    if (timeFrom || timeTo) {
      const d = parseLocalDateTime(t.datetime)
      const hhmm = d.toTimeString().slice(0,5)
      if (timeFrom && hhmm < timeFrom) return false
      if (timeTo && hhmm > timeTo) return false
    }
    return true;
  });

  const sorted = filtered.slice()
  if (sortBy === 'price_asc') sorted.sort((a,b) => a.price - b.price)
  if (sortBy === 'price_desc') sorted.sort((a,b) => b.price - a.price)
  if (sortBy === 'time_asc') sorted.sort((a,b) => parseLocalDateTime(a.datetime).getTime() - parseLocalDateTime(b.datetime).getTime())
  if (sortBy === 'time_desc') sorted.sort((a,b) => parseLocalDateTime(b.datetime).getTime() - parseLocalDateTime(a.datetime).getTime())
  if (sortBy === 'seats_desc') sorted.sort((a,b) => b.seats - a.seats)

  renderTickets(sorted);
}

async function submitSearch(e) {
  if (e) e.preventDefault();
  const from = document.getElementById('from').value.trim();
  const to = document.getElementById('to').value.trim();
  const startDate = String(startDateInput?.value || '')
  const endDate = String(endDateInput?.value || startDate)
  bookingType = String(tripTypeEl?.value || 'ONEWAY').toUpperCase()
  selectingLeg = 'outbound'
  selectedOutboundTrip = null

  if (!from || !to) {
    alert('Debes completar origen y destino para buscar.')
    return
  }
  if (!startDate) {
    alert('Debes indicar la fecha de inicio de búsqueda.')
    return
  }
  if (!endDate) {
    alert('Debes indicar la fecha fin de búsqueda.')
    return
  }
  if (endDate < startDate) {
    alert('La fecha fin no puede ser menor que la fecha inicio.')
    return
  }
  try {
    const searchParams = { origin: from, destination: to }
    searchParams.startDate = startDate
    searchParams.endDate = endDate
    apiTickets = await fetchTrips(searchParams)
    hasSearched = true
    applyClientFilters()
  } catch (err) {
    apiTickets = []
    hasSearched = true
    if (resultsPanel) resultsPanel.classList.remove('is-hidden')
    renderTickets([])
    const message = err instanceof Error ? err.message : 'No se pudo buscar viajes'
    alert(message)
  }
}

form.addEventListener('submit', submitSearch);

document.getElementById('filtersReset')?.addEventListener('click', () => {
  const ids = ['filterMinPrice','filterMaxPrice','filterSeats','filterTimeFrom','filterTimeTo','sortBy']
  ids.forEach(id => {
    const el = document.getElementById(id)
    if (!el) return
    if (el.tagName === 'SELECT') el.value = 'recommend'
    else el.value = ''
  })
  applyClientFilters()
})

let debounceTimer;
document.getElementById('passengers')?.addEventListener('input', () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => applyClientFilters(), 250)
})

startDateInput?.addEventListener('change', syncDateBounds)
endDateInput?.addEventListener('change', syncDateBounds)
syncDateBounds()

['filterMinPrice','filterMaxPrice','filterSeats','filterTimeFrom','filterTimeTo','sortBy'].forEach(id => {
  const el = document.getElementById(id)
  el?.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => applyClientFilters(), 250)
  })
  el?.addEventListener('change', () => applyClientFilters())
})

function openModal(t) {
  if (!detailsModal) return
  selectedTripId = Number(t.id)
  if (modalRoute) modalRoute.textContent = `${t.from} → ${t.to}`
  if (modalRouteCode) modalRouteCode.textContent = t.routeCode || '—'
  if (modalTime) modalTime.textContent = formatDateTime(t.datetime)
  if (modalArrival) modalArrival.textContent = formatDateTime(t.arrivalAt)
  if (modalDuration) modalDuration.textContent = t.duration || '—'
  const passengerCount = getPassengerCount()
  if (modalPrice) modalPrice.textContent = `€${t.price.toFixed(2)} / persona · Total €${(t.price * passengerCount).toFixed(2)}`
  if (modalSeats) modalSeats.textContent = `${t.seats} plazas`
  if (modalDesc) modalDesc.textContent = t.desc || ''
  if (modalChooseBtn) {
    modalChooseBtn.removeAttribute('disabled')
    if (getToken()) {
      modalChooseBtn.textContent = bookingType === 'ROUNDTRIP'
        ? (selectingLeg === 'outbound' ? 'Elegir ida' : 'Elegir vuelta')
        : 'Elegir'
    } else {
      modalChooseBtn.textContent = 'Inicia sesión'
    }
  }
  if (typeof detailsModal.showModal === 'function' && !detailsModal.open) {
    detailsModal.showModal()
  }
  detailsModal.classList.add('open')
  detailsModal.setAttribute('aria-hidden', 'false')
}

function closeModal() {
  if (!detailsModal) return
  selectedTripId = null
  detailsModal.classList.remove('open')
  detailsModal.setAttribute('aria-hidden', 'true')
  if (detailsModal.open && typeof detailsModal.close === 'function') {
    detailsModal.close()
  }
}

window.__bjourneyCloseModal = closeModal
window.__bjourneyChooseTrip = () => handleChooseTrip(modalChooseBtn)

function handleChooseTrip(triggerEl) {
  if (!selectedTripId) return

  if (bookingType === 'ROUNDTRIP' && selectingLeg === 'return') {
    openPassengerInfo(Number(selectedOutboundTrip?.id || 0), triggerEl, Number(selectedTripId))
    return
  }

  if (bookingType === 'ROUNDTRIP' && selectingLeg === 'outbound') {
    const selectedBtn = ticketsGrid?.querySelector(`.btn-buy[data-id="${selectedTripId}"]`)
    if (selectedBtn) {
      selectedBtn.click()
      closeModal()
    }
    return
  }

  openPassengerInfo(selectedTripId, triggerEl)
}

modalCloseBtn?.addEventListener('click', closeModal)
modalActionCloseBtn?.addEventListener('click', closeModal)
detailsModal?.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof Element)) return
  if (target === detailsModal) {
    e.preventDefault()
    closeModal()
  }
})

modalChooseBtn?.addEventListener('click', (e) => {
  e.preventDefault()
  handleChooseTrip(modalChooseBtn)
})

document.addEventListener('click', (e) => {
  const target = e.target
  if (!(target instanceof Element)) return

  if (target.closest('#modalCloseBtn') || target.closest('#modalActionCloseBtn')) {
    e.preventDefault()
    closeModal()
    return
  }

  if (target.closest('#modalChooseBtn')) {
    e.preventDefault()
    handleChooseTrip(modalChooseBtn || target)
  }
}, true)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal()
})
