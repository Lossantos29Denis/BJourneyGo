import { fetchWithAuth } from '/src/scripts/api.js'

// ─── helpers ─────────────────────────────────────────────────────────────────
function esc(v) {
  return String(v ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}

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
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
    + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function qrImageUrl(token) {
  return `https://quickchart.io/qr?size=180&text=${encodeURIComponent(String(token || ''))}`
}

function statusBadge(status) {
  const map = {
    PAID: ['Pagado', '#15803d', '#dcfce7'],
    PENDING: ['Pendiente', '#92400e', '#fef3c7'],
    CANCELLED: ['Cancelado', '#991b1b', '#fee2e2'],
    CONFIRMED: ['Confirmado', '#1d4ed8', '#dbeafe'],
    USED: ['Usado', '#374151', '#f3f4f6'],
  }
  const [label, color, bg] = map[String(status || '').toUpperCase()] || [status || '—', '#374151', '#f3f4f6']
  return `<span class="status-badge" style="color:${color};background:${bg}">${esc(label)}</span>`
}

function ticketsHtml(tickets) {
  if (!tickets?.length) return '<p class="no-tickets">Sin billetes registrados.</p>'
  return tickets.map((t, i) => {
    const name = t.passengerName || `Billete ${i + 1}`
    const route = `${t.origin || ''}  →  ${t.destination || ''}`
    const canDownloadPdf = Boolean(t.uuid)
    const canDownloadQr = Boolean(t.qrToken)
    const canChangeTrip = Boolean(t.uuid) && String(t.status || '').toUpperCase() === 'ACTIVE'
    return `
      <article class="ticket-item">
        <div class="ticket-info">
          <h4>${esc(name)}</h4>
          ${t.passengerIdentification ? `<p><strong>ID:</strong> ${esc(t.passengerIdentification)}</p>` : ''}
          <p><strong>Ruta:</strong> ${esc(route)}</p>
          ${t.routeCode ? `<p><strong>Código:</strong> ${esc(t.routeCode)}</p>` : ''}
          ${t.departureAt ? `<p><strong>Salida:</strong> ${esc(fmtDate(t.departureAt))}</p>` : ''}
          ${t.verifiedAt ? `<p><strong>Verificado:</strong> ${esc(fmtDate(t.verifiedAt))}</p>` : ''}
          <p><strong>Estado:</strong> ${statusBadge(t.status)}</p>
          ${canDownloadPdf ? `<button class="btn-download-pdf" data-ticket-uuid="${esc(t.uuid)}" title="Descargar billete en PDF">⬇ Descargar PDF</button>` : ''}
          ${canDownloadQr ? `<button class="btn-download-qr" data-qr-token="${esc(t.qrToken)}" data-ticket-name="${esc(name)}" title="Descargar imagen QR">⬇ Descargar QR</button>` : ''}
          ${canChangeTrip ? `<div class="ticket-actions"><button type="button" class="btn-change-trip" data-ticket-uuid="${esc(t.uuid)}">Cambiar viaje</button><span class="ticket-change-hint">Se abre una ventana completa para elegir otro viaje y revisar diferencias de precio.</span></div>` : ''}
        </div>
        <div class="ticket-qr">
          ${t.qrToken
            ? `<img src="${qrImageUrl(t.qrToken)}" alt="QR de ${esc(name)}" loading="lazy" />`
            : '<div class="qr-empty">QR no disponible</div>'}
        </div>
      </article>`
  }).join('')
}

function openTripChangePage(ticketUuid) {
  const route = `/mis-viajes/cambiar/${encodeURIComponent(ticketUuid)}`
  const popup = window.open(route, '_blank', 'noopener,noreferrer')
  if (!popup) window.location.href = route
}

async function downloadTicketPdf(uuid) {
  try {
    const res = await fetchWithAuth(`/api/tickets/${uuid}/pdf`)
    if (!res.ok) { alert('No se pudo generar el PDF. Inténtalo de nuevo.'); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billete-${uuid.slice(0, 8)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    alert('Error al descargar el PDF.')
  }
}

async function downloadQrImage(token, ticketName = 'billete') {
  try {
    const safeName = String(ticketName || 'billete').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'billete'
    const res = await fetch(qrImageUrl(token))
    if (!res.ok) {
      alert('No se pudo descargar el QR. Inténtalo de nuevo.')
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `qr-${safeName}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch {
    alert('Error al descargar el QR.')
  }
}

// ─── my orders (logged-in mode) ──────────────────────────────────────────────
const myOrdersSection = document.getElementById('myOrdersSection')
const myOrdersContent = document.getElementById('myOrdersContent')
const lookupDivider = document.getElementById('lookupDivider')
const lookupSubtitle = document.getElementById('lookupSubtitle')

const token = localStorage.getItem('bjourney_token')

if (token) {
  myOrdersSection.style.display = 'block'
  lookupDivider.style.display = 'flex'
  lookupSubtitle.textContent = 'También puedes buscar cualquier reserva por código de referencia.'

  fetchWithAuth('/api/orders/my')
    .then(r => r.json().catch(() => ({})))
    .then(data => {
      const orders = Array.isArray(data.orders) ? data.orders : []
      if (!orders.length) {
        myOrdersContent.innerHTML = '<p class="no-orders">Aún no tienes viajes registrados. <a href="/comprar">Compra tu primer billete</a>.</p>'
        return
      }
      myOrdersContent.innerHTML = orders.map(o => `
        <div class="order-card">
          <button class="order-header" type="button" aria-expanded="false" aria-controls="order-body-${o.id}" data-order-id="${o.id}">
            <div class="order-header-left">
              <span class="order-ref">${esc(o.referenceCode || '#' + o.id)}</span>
              <span class="order-route">${esc(o.tickets?.[0]?.origin || '—')} → ${esc(o.tickets?.[0]?.destination || '—')}</span>
              ${o.tickets?.[0]?.departureAt ? `<span class="order-date">${esc(fmtDate(o.tickets[0].departureAt))}</span>` : ''}
            </div>
            <div class="order-header-right">
              ${statusBadge(o.status)}
              <span class="order-total">${esc(String(o.totalAmount))} ${esc(o.currency || 'EUR')}</span>
              <span class="order-chevron" aria-hidden="true">▾</span>
            </div>
          </button>
          <div class="order-body" id="order-body-${o.id}" hidden>
            <div class="tickets-list">${ticketsHtml(o.tickets)}</div>
          </div>
        </div>`
      ).join('')

      // Auto-expand first order
      const firstBtn = myOrdersContent.querySelector('.order-header')
      if (firstBtn) toggleOrder(firstBtn)

      myOrdersContent.addEventListener('click', e => {
        const dlBtn = e.target.closest('.btn-download-pdf')
        if (dlBtn) { downloadTicketPdf(dlBtn.dataset.ticketUuid); return }
        const qrBtn = e.target.closest('.btn-download-qr')
        if (qrBtn) { downloadQrImage(qrBtn.dataset.qrToken, qrBtn.dataset.ticketName); return }
        const changeBtn = e.target.closest('.btn-change-trip')
        if (changeBtn) { openTripChangePage(changeBtn.dataset.ticketUuid); return }
        const btn = e.target.closest('.order-header')
        if (btn) toggleOrder(btn)
      })
    })
    .catch(() => {
      myOrdersContent.innerHTML = '<p class="lookup-message error">No se pudieron cargar tus viajes. Inténtalo de nuevo.</p>'
    })
}

function toggleOrder(btn) {
  const orderId = btn.dataset.orderId
  const body = document.getElementById(`order-body-${orderId}`)
  const chevron = btn.querySelector('.order-chevron')
  if (!body) return
  const expanded = btn.getAttribute('aria-expanded') === 'true'
  btn.setAttribute('aria-expanded', String(!expanded))
  body.hidden = expanded
  if (chevron) chevron.textContent = expanded ? '▾' : '▴'
}

// ─── guest lookup form ────────────────────────────────────────────────────────
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

function setMessage(text, kind = '') {
  messageEl.textContent = text || ''
  messageEl.className = `lookup-message ${kind}`.trim()
}

function renderReservation(payload) {
  const order = payload?.order || null
  const tickets = payload?.tickets || []
  if (!order) return
  panelEl.classList.remove('is-hidden')
  metaEl.innerHTML = `
    <span>Referencia: <strong>${esc(order.referenceCode || '—')}</strong></span>
    <span>Estado: ${statusBadge(order.status)}</span>
    <span>Total: <strong>${esc(order.totalAmount)} ${esc(order.currency || '')}</strong></span>`
  ticketsListEl.innerHTML = tickets.map((t, index) => {
    const name = t.passengerName || `Billete ${index + 1}`
    const canDownloadQr = Boolean(t.qrToken)
    return `
      <article class="ticket-item">
        <div class="ticket-info">
          <h4>${esc(name)}</h4>
          <p><strong>Ruta:</strong> ${esc(t.origin || '')} → ${esc(t.destination || '')}</p>
          ${t.routeCode ? `<p><strong>Código ruta:</strong> ${esc(t.routeCode)}</p>` : ''}
          ${t.departureAt ? `<p><strong>Salida:</strong> ${esc(fmtDate(t.departureAt))}</p>` : ''}
          ${t.passengerIdentification ? `<p><strong>Identificación:</strong> ${esc(t.passengerIdentification)}</p>` : ''}
          <p><strong>Estado:</strong> ${statusBadge(t.status)}</p>
          ${canDownloadQr ? `<button class="btn-download-qr" data-qr-token="${esc(t.qrToken)}" data-ticket-name="${esc(name)}" title="Descargar imagen QR">⬇ Descargar QR</button>` : ''}
        </div>
        <div class="ticket-qr">
          ${t.qrToken ? `<img src="${qrImageUrl(t.qrToken)}" alt="QR de ${esc(name)}" loading="lazy" />` : '<div class="qr-empty">QR no disponible</div>'}
        </div>
      </article>`
  }).join('')
}

ticketsListEl?.addEventListener('click', (e) => {
  const qrBtn = e.target.closest('.btn-download-qr')
  if (!qrBtn) return
  downloadQrImage(qrBtn.dataset.qrToken, qrBtn.dataset.ticketName)
})

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
      body: JSON.stringify({ identifier: currentIdentifier, referenceCode: currentReferenceCode, contactEmail, contactPhone })
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

// Prefill from URL params (coming from purchase confirmation)
const urlParams = new URLSearchParams(window.location.search)
const prefillRef = urlParams.get('ref')
const prefillEmail = urlParams.get('email')
const storedLookupRaw = sessionStorage.getItem('lastPurchaseLookup')
let storedLookup = null
try {
  storedLookup = storedLookupRaw ? JSON.parse(storedLookupRaw) : null
} catch (_e) {
  storedLookup = null
}
if (prefillRef) {
  const refInput = document.getElementById('referenceCode')
  if (refInput) refInput.value = prefillRef
}
if (prefillEmail) {
  const emailInput = document.getElementById('identifier')
  if (emailInput) emailInput.value = prefillEmail
}
if (!prefillRef && storedLookup?.ref) {
  const refInput = document.getElementById('referenceCode')
  if (refInput) refInput.value = storedLookup.ref
}
if (!prefillEmail && storedLookup?.email) {
  const emailInput = document.getElementById('identifier')
  if (emailInput) emailInput.value = storedLookup.email
}
if ((prefillRef && prefillEmail) || (storedLookup?.ref && storedLookup?.email)) {
  lookupForm?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
}
