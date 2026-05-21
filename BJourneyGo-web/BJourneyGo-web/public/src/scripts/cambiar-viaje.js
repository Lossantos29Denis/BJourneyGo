import { fetchWithAuth } from '/src/scripts/api.js'

function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

function parseLocalDateTime(dateTimeStr) {
  if (!dateTimeStr || typeof dateTimeStr !== 'string') return new Date(NaN)
  const match = dateTimeStr.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (!match) return new Date(dateTimeStr)
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
  const date = parseLocalDateTime(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return `${date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`
}

function fmtMoney(value, currency = 'EUR') {
  return `${Number(value || 0).toFixed(2)} ${String(currency || 'EUR').toUpperCase()}`
}

const app = document.getElementById('changeTripApp')
const stateEl = document.getElementById('changeState')
const currentCardEl = document.getElementById('currentTicketCard')
const alternativesListEl = document.getElementById('alternativesList')
const alternativesCountEl = document.getElementById('alternativesCount')
const cancelTicketBtn = document.getElementById('cancelTicketBtn')
const refundRequestForm = document.getElementById('refundRequestForm')
const refundReasonEl = document.getElementById('refundReason')
const refundNotesEl = document.getElementById('refundNotes')
const refundSubmitBtn = document.getElementById('refundSubmitBtn')
const ticketUuid = String(app?.dataset?.ticketUuid || '').trim()
const token = localStorage.getItem('bjourney_token')

function showState(text, kind = '') {
  if (!stateEl) return
  stateEl.textContent = text || ''
  stateEl.className = `change-state ${kind}`.trim()
}

function renderCurrentTicket(ticket) {
  const currency = ticket.currency || 'EUR'
  currentCardEl.classList.remove('empty-card')
  currentCardEl.innerHTML = `
    <div class="ticket-meta-grid">
      <div><span>Ruta</span><strong>${esc(ticket.origin || '—')} → ${esc(ticket.destination || '—')}</strong></div>
      <div><span>Código</span><strong>${esc(ticket.routeCode || '—')}</strong></div>
      <div><span>Salida actual</span><strong>${esc(fmtDate(ticket.departureAt))}</strong></div>
      <div><span>Llegada actual</span><strong>${esc(fmtDate(ticket.arrivalAt))}</strong></div>
      <div><span>Precio actual</span><strong>${esc(fmtMoney(ticket.currentPrice, currency))}</strong></div>
      <div><span>Billete</span><strong>${esc(ticket.uuid || ticketUuid)}</strong></div>
    </div>
  `
}

function renderAlternative(ticket, alt) {
  const currency = ticket.currency || 'EUR'
  const currentPrice = Number(ticket.currentPrice || 0)
  const newPrice = Number(alt.basePrice || 0)
  const delta = Math.max(0, Math.round((newPrice - currentPrice) * 100) / 100)
  const seatsLeft = Math.max(0, Number(alt.capacity || 0) - Number(alt.seatsSold || 0))

  return `
    <article class="alt-card">
      <div class="alt-main">
        <div class="alt-title-row">
          <h3>${esc(alt.origin || '—')} → ${esc(alt.destination || '—')}</h3>
          <span class="alt-chip">${delta > 0 ? `+${esc(fmtMoney(delta, currency))}` : 'Sin coste adicional'}</span>
        </div>
        <div class="alt-grid">
          <div><span>Salida</span><strong>${esc(fmtDate(alt.departureAt))}</strong></div>
          <div><span>Llegada</span><strong>${esc(fmtDate(alt.arrivalAt))}</strong></div>
          <div><span>Precio</span><strong>${esc(fmtMoney(newPrice, currency))}</strong></div>
          <div><span>Plazas</span><strong>${esc(String(seatsLeft))} libres</strong></div>
        </div>
        <p class="alt-note">Al confirmar, se resta 1 plaza del viaje original y se suma 1 a este viaje, respetando la capacidad marcada por la agencia.</p>
      </div>
      <div class="alt-actions">
        <button type="button" class="btn btn--primary btn-change-select" data-new-trip-id="${esc(alt.id)}" data-current-price="${esc(String(currentPrice))}" data-new-trip-price="${esc(String(newPrice))}">
          ${delta > 0 ? `Pagar diferencia ${esc(fmtMoney(delta, currency))}` : 'Cambiar sin coste'}
        </button>
      </div>
    </article>
  `
}

async function loadTicket() {
  if (!token) {
    showState('Necesitas iniciar sesión para cambiar un billete.', 'error')
    currentCardEl.innerHTML = '<p class="empty-copy">No hay sesión activa.</p>'
    alternativesListEl.innerHTML = ''
    return
  }
  if (!ticketUuid) {
    showState('No se ha podido identificar el billete.', 'error')
    return
  }

  showState('Cargando alternativas…')
  const res = await fetchWithAuth(`/api/orders/tickets/${encodeURIComponent(ticketUuid)}/alternatives`)
  const payload = await res.json().catch(() => ({}))
  if (!res.ok) {
    showState(payload?.error || 'No se pudieron cargar las alternativas.', 'error')
    currentCardEl.innerHTML = '<p class="empty-copy">No se pudo cargar el billete.</p>'
    alternativesListEl.innerHTML = ''
    alternativesCountEl.textContent = ''
    return
  }

  const ticket = payload.ticket || {}
  const alternatives = Array.isArray(payload.alternatives) ? payload.alternatives : []
  renderCurrentTicket(ticket)
  alternativesCountEl.textContent = `${alternatives.length} viaje${alternatives.length === 1 ? '' : 's'} disponible${alternatives.length === 1 ? '' : 's'}`
  alternativesListEl.innerHTML = alternatives.length
    ? alternatives.map((alt) => renderAlternative(ticket, alt)).join('')
    : '<p class="empty-copy">No hay viajes disponibles para este trayecto.</p>'

  const changed = new URLSearchParams(window.location.search).get('changed')
  const cancelled = new URLSearchParams(window.location.search).get('cancelled')
  if (changed === '1') {
    showState('El cambio de viaje se ha completado correctamente.', 'ok')
  } else if (cancelled === '1') {
    showState('El pago fue cancelado antes de confirmar el cambio.', 'warn')
  } else {
    showState('Elige un nuevo viaje. El sistema ajustará las plazas ocupadas automáticamente.', '')
  }
}

async function handleChangeSelect(button) {
  const newTripId = Number(button?.dataset?.newTripId || 0)
  const currentPrice = Number(button?.dataset?.currentPrice || 0)
  const newTripPrice = Number(button?.dataset?.newTripPrice || 0)
  if (!newTripId) return

  const delta = Math.max(0, Math.round((newTripPrice - currentPrice) * 100) / 100)
  button.setAttribute('disabled', 'true')

  try {
    if (delta > 0) {
      const res = await fetchWithAuth(`/api/orders/tickets/${encodeURIComponent(ticketUuid)}/change-trip-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newTripId,
          successUrl: `${window.location.origin}/mis-viajes/cambiar/${encodeURIComponent(ticketUuid)}?changed=1`,
          cancelUrl: `${window.location.origin}/mis-viajes/cambiar/${encodeURIComponent(ticketUuid)}?cancelled=1`,
        })
      })
      const payload = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(payload?.error || 'No se pudo iniciar el pago de la diferencia')
      if (payload?.url) {
        window.location.href = payload.url
        return
      }
      throw new Error('No se recibió la URL de pago')
    }

    const res = await fetchWithAuth(`/api/orders/tickets/${encodeURIComponent(ticketUuid)}/change-trip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newTripId })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || 'No se pudo completar el cambio')
    showState('Cambio aplicado correctamente. Actualizando datos…', 'ok')
    await loadTicket()
  } catch (error) {
    showState(error instanceof Error ? error.message : 'No se pudo completar el cambio.', 'error')
  } finally {
    button.removeAttribute('disabled')
  }
}

async function cancelTicket() {
  if (!window.confirm('Se cancelará el billete y se liberará la plaza del viaje actual. ¿Deseas continuar?')) return
  if (!ticketUuid) return

  cancelTicketBtn?.setAttribute('disabled', 'true')
  showState('Cancelando billete…')

  try {
    const res = await fetchWithAuth(`/api/orders/tickets/${encodeURIComponent(ticketUuid)}/cancel`, { method: 'POST' })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || 'No se pudo cancelar el billete')
    showState('Billete cancelado correctamente. Volviendo a Mis Viajes…', 'ok')
    setTimeout(() => {
      window.location.href = '/mis-viajes?cancelled=1'
    }, 900)
  } catch (error) {
    showState(error instanceof Error ? error.message : 'No se pudo cancelar el billete.', 'error')
  } finally {
    cancelTicketBtn?.removeAttribute('disabled')
  }
}

async function submitRefundRequest(event) {
  event.preventDefault()
  if (!ticketUuid) return

  const reason = String(refundReasonEl?.value || '').trim()
  const notes = String(refundNotesEl?.value || '').trim()
  if (!reason) {
    showState('Selecciona un motivo para la solicitud de reembolso.', 'error')
    return
  }

  refundSubmitBtn?.setAttribute('disabled', 'true')
  showState('Enviando solicitud de reembolso asistido…')

  try {
    const res = await fetchWithAuth(`/api/orders/tickets/${encodeURIComponent(ticketUuid)}/refund-request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, notes })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(payload?.error || 'No se pudo enviar la solicitud')
    showState('Solicitud enviada. La agencia y el equipo técnico la revisarán.', 'ok')
    if (refundNotesEl) refundNotesEl.value = ''
    if (refundReasonEl) refundReasonEl.value = ''
  } catch (error) {
    showState(error instanceof Error ? error.message : 'No se pudo enviar la solicitud.', 'error')
  } finally {
    refundSubmitBtn?.removeAttribute('disabled')
  }
}

alternativesListEl?.addEventListener('click', (event) => {
  const button = event.target.closest('.btn-change-select')
  if (!button) return
  handleChangeSelect(button)
})

cancelTicketBtn?.addEventListener('click', cancelTicket)
refundRequestForm?.addEventListener('submit', submitRefundRequest)

loadTicket().catch((error) => {
  showState(error instanceof Error ? error.message : 'No se pudo cargar la página.', 'error')
})
