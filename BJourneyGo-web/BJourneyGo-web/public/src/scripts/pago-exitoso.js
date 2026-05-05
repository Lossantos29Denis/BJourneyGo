const statusText = document.getElementById('statusText')
const openAppLink = document.getElementById('openAppLink')
const purchaseContent = document.getElementById('purchaseContent')
let lastPurchaseMeta = null
let misViajesTimeout = null
let appLinkTarget = ''

function setAppLinkTarget(url) {
  appLinkTarget = String(url || '').trim()
  if (openAppLink) {
    openAppLink.href = appLinkTarget || '#'
  }
}

function launchApp() {
  if (!appLinkTarget) return false
  window.location.href = appLinkTarget
  return true
}

const params = new URLSearchParams(window.location.search)
const sessionId = params.get('session_id')

if (openAppLink && sessionId) {
  setAppLinkTarget(`bjourneygo://payment/result?status=success&session_id=${encodeURIComponent(sessionId)}`)
}

if (openAppLink) {
  openAppLink.addEventListener('click', (event) => {
    event.preventDefault()
    launchApp()
  })
}

async function confirm() {
  if (!sessionId) {
    if (statusText) statusText.textContent = 'No se encontró el pago.'
    return
  }
  try {
    const res = await fetch('/api/stripe/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId })
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (statusText) statusText.textContent = json.error || 'No se pudo validar el pago.'
      return
    }
    if (statusText) statusText.textContent = 'Pago validado. Compra completada correctamente.'

    const purchase = json?.purchase || null
    if (!purchase || !purchaseContent) return
    lastPurchaseMeta = purchase

    if (openAppLink) {
      const appParams = new URLSearchParams({
        status: 'success',
        session_id: String(sessionId || ''),
        ref: String(purchase.referenceCode || ''),
        email: String(purchase.contactEmail || '')
      })
      setAppLinkTarget(`bjourneygo://payment/result?${appParams.toString()}`)
    }

    const esc = (v) => String(v ?? '')
      .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;').replaceAll("'", '&#039;')

    const parseLocalDateTime = (value) => {
      if (!value || typeof value !== 'string') return new Date(NaN)
      const m = value.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
      if (m) {
        const [, y, mo, d, h, mi, s] = m
        return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s || '0'))
      }
      return new Date(value)
    }

    const fmtDate = (value) => {
      const d = parseLocalDateTime(value)
      if (Number.isNaN(d.getTime())) return String(value || '-')
      return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
    }

    const qrUrl = (token) => `https://quickchart.io/qr?size=200&text=${encodeURIComponent(String(token || ''))}`

    const downloadQrImage = async (token, ticketName = 'billete') => {
      try {
        const safeName = String(ticketName || 'billete').trim().replace(/[^a-z0-9-_]+/gi, '-').replace(/-+/g, '-').replace(/(^-|-$)/g, '').toLowerCase() || 'billete'
        const res = await fetch(qrUrl(token))
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

    const printTicket = (tickets, trip, referenceCode, idx) => {
      const t = tickets[idx]
      if (!t) return
      const name = t.passengerName || `Billete ${idx + 1}`
      const w = window.open('', '_blank', 'width=520,height=760')
      if (!w) return
      const rows = [
        t.passengerIdentification ? `<tr><td>DNI / ID</td><td>${esc(t.passengerIdentification)}</td></tr>` : '',
        trip?.routeCode ? `<tr><td>Código ruta</td><td>${esc(trip.routeCode)}</td></tr>` : '',
        trip?.departureAt ? `<tr><td>Salida</td><td>${esc(fmtDate(trip.departureAt))}</td></tr>` : '',
        trip?.arrivalAt ? `<tr><td>Llegada</td><td>${esc(fmtDate(trip.arrivalAt))}</td></tr>` : '',
        `<tr><td>Referencia</td><td><strong>${esc(referenceCode || '')}</strong></td></tr>`,
        `<tr><td>Estado</td><td>✅ PAGADO</td></tr>`,
      ].filter(Boolean).join('')
      const qrHtml = t.qrToken ? `<div class="qr-wrap"><img id="qrImg" src="${qrUrl(t.qrToken)}" alt="QR" width="220" height="220"></div>` : ''
      w.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${esc(name)} — BJourneyGo</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,sans-serif;color:#111;padding:2rem 2.5rem;max-width:480px}.brand{font-weight:800;font-size:1.1rem;color:#1d4ed8}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1d4ed8;padding-bottom:.6rem;margin-bottom:1rem}.sublbl{font-size:.7rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;display:block;margin-bottom:.15rem}.passenger{font-size:1.4rem;font-weight:700}.route{font-size:.98rem;color:#374151;margin:.2rem 0 1rem}table{width:100%;border-collapse:collapse;font-size:.87rem;margin-bottom:1rem}td{padding:.28rem 0;border-bottom:1px solid #f3f4f6;vertical-align:top}td:first-child{color:#6b7280;width:130px}.qr-wrap{text-align:center;margin:.75rem 0 1rem}.qr-wrap img{border:1px solid #e5e7eb;border-radius:8px}.footer{text-align:center;font-size:.74rem;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:.6rem}@media print{body{padding:1rem}}</style></head><body><div class="header"><span class="brand">BJourneyGo</span><span style="font-size:.75rem;color:#9ca3af">Billete ${idx + 1} / ${tickets.length}</span></div><span class="sublbl">Pasajero</span><div class="passenger">${esc(name)}</div><div class="route">${esc(trip?.origin || '')} → ${esc(trip?.destination || '')}</div><table>${rows}</table>${qrHtml}<div class="footer">Presenta este billete al conductor · BJourneyGo</div></body></html>`)
      w.document.close()
      const img = w.document.getElementById('qrImg')
      if (img) {
        img.onload = () => { w.focus(); w.print() }
        img.onerror = () => { w.focus(); w.print() }
      } else {
        setTimeout(() => { w.focus(); w.print() }, 400)
      }
    }

    const tickets = Array.isArray(purchase.tickets) ? purchase.tickets : []
    const trip = purchase.trip || null
    purchaseContent.innerHTML = `
      <div class="info-block">
        <h3>Resumen de compra</h3>
        <div class="info-row"><span class="lbl">Referencia</span><strong>${esc(purchase.referenceCode || '-')}</strong></div>
        <div class="info-row"><span class="lbl">Estado</span><strong>${esc(purchase.status || 'PAID')}</strong></div>
        <div class="info-row"><span class="lbl">Total</span><strong>${esc(String(purchase.total || 0))} ${esc(purchase.currency || 'EUR')}</strong></div>
      </div>
      <div class="info-block">
        <h3>Viaje</h3>
        <div class="info-row"><span class="lbl">Ruta</span><strong>${esc(trip?.origin || '')} → ${esc(trip?.destination || '')}</strong></div>
        ${trip?.routeCode ? `<div class="info-row"><span class="lbl">Código</span><strong>${esc(trip.routeCode)}</strong></div>` : ''}
        ${trip?.departureAt ? `<div class="info-row"><span class="lbl">Salida</span><strong>${esc(fmtDate(trip.departureAt))}</strong></div>` : ''}
        ${trip?.arrivalAt ? `<div class="info-row"><span class="lbl">Llegada</span><strong>${esc(fmtDate(trip.arrivalAt))}</strong></div>` : ''}
      </div>
      <div class="tickets-section">
        <h2>Billetes (${tickets.length})</h2>
        ${tickets.map((t, i) => `
          <div class="ticket-card">
            <div class="ticket-info">
              <h4>${esc(t.passengerName || `Billete ${i + 1}`)}</h4>
              ${t.passengerIdentification ? `<p><strong>ID:</strong> ${esc(t.passengerIdentification)}</p>` : ''}
              <button class="download-btn" data-print-idx="${i}" type="button">⬇ Descargar billete</button>
              ${t.qrToken ? `<button class="download-qr-btn" data-qr-token="${esc(t.qrToken)}" data-ticket-name="${esc(t.passengerName || `billete-${i + 1}`)}" type="button">⬇ Descargar QR</button>` : ''}
            </div>
            <div class="ticket-qr">
              ${t.qrToken ? `<img src="${qrUrl(t.qrToken)}" alt="QR" loading="lazy" />` : '<div class="no-qr">Sin QR</div>'}
            </div>
          </div>
        `).join('')}
      </div>
    `

    const myTripsLink = document.createElement('a')
    myTripsLink.className = 'btn btn--ghost'
    myTripsLink.textContent = 'Ver mis viajes'
    myTripsLink.href = `/mis-viajes?${new URLSearchParams({
      ref: String(purchase.referenceCode || ''),
      email: String(purchase.contactEmail || '')
    }).toString()}`
    const actions = document.querySelector('.checkout-actions')
    if (actions && !actions.querySelector('[data-mytrips-link]')) {
      myTripsLink.setAttribute('data-mytrips-link', 'true')
      actions.insertBefore(myTripsLink, openAppLink || actions.firstChild)
    }

    if (purchase.referenceCode && purchase.contactEmail) {
      sessionStorage.setItem('lastPurchaseLookup', JSON.stringify({ ref: purchase.referenceCode, email: purchase.contactEmail }))
    }

    if (misViajesTimeout) clearTimeout(misViajesTimeout)
    const misViajesParams = new URLSearchParams({
      ref: String(purchase.referenceCode || ''),
      email: String(purchase.contactEmail || '')
    })
    misViajesTimeout = setTimeout(() => {
      window.location.href = `/mis-viajes?${misViajesParams.toString()}`
    }, 1400)

    purchaseContent.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-print-idx]')
      if (btn) {
        const idx = Number(btn.getAttribute('data-print-idx') || -1)
        if (idx < 0) return
        printTicket(tickets, trip, purchase.referenceCode, idx)
        return
      }
      const qrBtn = e.target.closest('[data-qr-token]')
      if (!qrBtn) return
      downloadQrImage(qrBtn.getAttribute('data-qr-token'), qrBtn.getAttribute('data-ticket-name'))
    })
  } catch (e) {
    if (statusText) statusText.textContent = 'Error de conexión al validar el pago.'
  }
}

confirm()
