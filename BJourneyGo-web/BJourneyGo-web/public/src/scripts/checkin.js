const lookupForm = document.getElementById('checkinLookupForm')
const messageEl = document.getElementById('checkinMessage')
const panelEl = document.getElementById('reservationPanel')
const metaEl = document.getElementById('reservationMeta')
const ticketsListEl = document.getElementById('ticketsList')
const lookupBtn = document.getElementById('lookupBtn')

const updateForm = document.getElementById('contactUpdateForm')
const updateBtn = document.getElementById('updateContactBtn')

let currentIdentifier = ''
let currentReferenceCode = ''

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

function setMessage(text, kind = '') {
  messageEl.textContent = text || ''
  messageEl.className = `checkin-message ${kind}`.trim()
}

function fmtDate(value) {
  if (!value) return ''
  const d = parseLocalDateTime(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.toLocaleDateString()} · ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function qrImageUrl(token) {
  const encoded = encodeURIComponent(String(token || ''))
  return `https://quickchart.io/qr?size=180&text=${encoded}`
}

function renderReservation(payload) {
  const order = payload?.order || null
  const tickets = payload?.tickets || []
  if (!order) return

  panelEl.classList.remove('is-hidden')
  metaEl.innerHTML = `
    <span>Referencia: <strong>${escapeHtml(order.referenceCode || '-')}</strong></span>
    <span>Estado: <strong>${escapeHtml(order.status || '-')}</strong></span>
    <span>Total: <strong>${escapeHtml(order.totalAmount)} ${escapeHtml(order.currency || '')}</strong></span>
  `

  ticketsListEl.innerHTML = tickets.map((t, index) => {
    const route = `${t.origin || ''} → ${t.destination || ''}`
    return `
      <article class="ticket-item">
        <div class="ticket-info">
          <h4>Billete ${index + 1}</h4>
          <p><strong>Ruta:</strong> ${escapeHtml(route)}</p>
          <p><strong>Código ruta:</strong> ${escapeHtml(t.routeCode || '-')}</p>
          <p><strong>Salida:</strong> ${escapeHtml(fmtDate(t.departureAt))}</p>
          <p><strong>Pasajero:</strong> ${escapeHtml(t.passengerName || '-')}</p>
          <p><strong>Identificación:</strong> ${escapeHtml(t.passengerIdentification || '-')}</p>
          <p><strong>Estado:</strong> ${escapeHtml(t.status || '-')}</p>
          <p><strong>UUID:</strong> ${escapeHtml(t.uuid || '-')}</p>
        </div>
        <div class="ticket-qr">
          ${t.qrToken ? `<img src="${qrImageUrl(t.qrToken)}" alt="QR del billete ${index + 1}" loading="lazy" />` : '<div class="qr-empty">QR no disponible</div>'}
        </div>
      </article>
    `
  }).join('')
}

async function lookupReservation(event) {
  event.preventDefault()
  const identifier = String(document.getElementById('identifier')?.value || '').trim()
  const referenceCode = String(document.getElementById('referenceCode')?.value || '').trim().toUpperCase()

  if (!identifier || !referenceCode) {
    setMessage('Completa correo/teléfono y referencia.', 'error')
    return
  }

  try {
    lookupBtn?.setAttribute('disabled', 'true')
    setMessage('Consultando reserva...')

    const res = await fetch('/api/checkin/lookup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, referenceCode })
    })
    const payload = await res.json().catch(() => ({}))

    if (!res.ok) {
      panelEl.classList.add('is-hidden')
      setMessage(payload?.error || 'No se pudo consultar la reserva.', 'error')
      return
    }

    currentIdentifier = identifier
    currentReferenceCode = referenceCode
    document.getElementById('contactEmail').value = payload?.order?.contactEmail || ''
    document.getElementById('contactPhone').value = payload?.order?.contactPhone || ''

    renderReservation(payload)
    setMessage('Reserva encontrada.', 'ok')
  } catch (e) {
    panelEl.classList.add('is-hidden')
    setMessage('Error de conexión al consultar la reserva.', 'error')
  } finally {
    lookupBtn?.removeAttribute('disabled')
  }
}

async function updateContact(event) {
  event.preventDefault()
  if (!currentIdentifier || !currentReferenceCode) {
    setMessage('Primero consulta tu reserva.', 'error')
    return
  }

  const contactEmail = String(document.getElementById('contactEmail')?.value || '').trim()
  const contactPhone = String(document.getElementById('contactPhone')?.value || '').trim()
  if (!contactEmail && !contactPhone) {
    setMessage('Ingresa correo o teléfono para actualizar.', 'error')
    return
  }

  try {
    updateBtn?.setAttribute('disabled', 'true')
    const res = await fetch('/api/checkin/update-contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: currentIdentifier,
        referenceCode: currentReferenceCode,
        contactEmail,
        contactPhone
      })
    })
    const payload = await res.json().catch(() => ({}))
    if (!res.ok) {
      setMessage(payload?.error || 'No se pudo actualizar contacto.', 'error')
      return
    }

    setMessage('Contacto actualizado correctamente.', 'ok')
  } catch (e) {
    setMessage('Error al actualizar contacto.', 'error')
  } finally {
    updateBtn?.removeAttribute('disabled')
  }
}

lookupForm?.addEventListener('submit', lookupReservation)
updateForm?.addEventListener('submit', updateContact)

// Prefill from URL params when coming from test purchase success page
const urlParams = new URLSearchParams(window.location.search)
const prefillRef = urlParams.get('ref')
const prefillEmail = urlParams.get('email')
if (prefillRef) {
  const refInput = document.getElementById('referenceCode')
  if (refInput) refInput.value = prefillRef
}
if (prefillEmail) {
  const emailInput = document.getElementById('identifier')
  if (emailInput) emailInput.value = prefillEmail
}
if (prefillRef && prefillEmail) {
  lookupForm?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
}
