import { getToken, fetchWithAuth, clearAuth } from '/src/scripts/api.js'

const params = new URLSearchParams(window.location.search)
const bookingType = String(params.get('bookingType') || 'ONEWAY').toUpperCase()
const tripId = Number(params.get('tripId') || 0)
const outboundTripId = Number(params.get('outboundTripId') || 0)
const returnTripId = Number(params.get('returnTripId') || 0)
const quantity = Number(params.get('quantity') || 1)
const tripFrom = params.get('from') || ''
const tripTo = params.get('to') || ''
const routeCode = params.get('routeCode') || ''
const departureAt = params.get('departureAt') || ''
const unitPrice = Number(params.get('unitPrice') || 0)
const outboundFrom = params.get('outboundFrom') || ''
const outboundTo = params.get('outboundTo') || ''
const outboundRouteCode = params.get('outboundRouteCode') || ''
const outboundDepartureAt = params.get('outboundDepartureAt') || ''
const outboundUnitPrice = Number(params.get('outboundUnitPrice') || 0)
const returnFrom = params.get('returnFrom') || ''
const returnTo = params.get('returnTo') || ''
const returnRouteCode = params.get('returnRouteCode') || ''
const returnDepartureAt = params.get('returnDepartureAt') || ''
const returnUnitPrice = Number(params.get('returnUnitPrice') || 0)
const seats = Number(params.get('seats') || 0)

const summaryEl = document.getElementById('tripSummary')
const pricingEl = document.getElementById('tripPricing')
const warningEl = document.getElementById('tripWarning')
const listEl = document.getElementById('passengersList')
const formEl = document.getElementById('passengersForm')
const submitBtn = document.getElementById('submitBtn')

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

function formatDateTime(dt) {
  if (!dt) return ''
  const d = parseLocalDateTime(dt)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function buildPassengerCard(index) {
  const humanIndex = index + 1
  const wrapper = document.createElement('section')
  wrapper.className = 'passenger-card'
  wrapper.innerHTML = `
    <h3>Pasajero ${humanIndex}${index === 0 ? ' (Contacto)' : ''}</h3>
    <div class="passenger-grid">
      <label>
        Nombre completo
        <input type="text" name="fullName-${index}" placeholder="Nombre y apellidos" minlength="3" required />
      </label>
      <label>
        Identificación
        <input type="text" name="identification-${index}" placeholder="DNI, NIE o Pasaporte" minlength="4" required />
      </label>
      <label>
        Teléfono${index === 0 ? ' (contacto)' : ' (opcional)'}
        <input type="tel" name="phone-${index}" placeholder="Ej. +34 600 000 000" ${index === 0 ? 'required' : ''} />
      </label>
      ${index === 0 ? `
      <label>
        Correo electrónico (contacto)
        <input type="email" name="email-${index}" placeholder="correo@ejemplo.com" required />
      </label>
      ` : ''}
    </div>
  `
  return wrapper
}

function renderPassengers() {
  listEl.innerHTML = ''
  for (let i = 0; i < quantity; i++) {
    listEl.appendChild(buildPassengerCard(i))
  }
}

function getPassengersPayload() {
  const passengers = []
  let contactEmail = ''
  for (let i = 0; i < quantity; i++) {
    const fullName = String(formEl.querySelector(`[name="fullName-${i}"]`)?.value || '').trim()
    const identification = String(formEl.querySelector(`[name="identification-${i}"]`)?.value || '').trim()
    const phone = String(formEl.querySelector(`[name="phone-${i}"]`)?.value || '').trim()
    const email = String(formEl.querySelector(`[name="email-${i}"]`)?.value || '').trim().toLowerCase()

    if (!fullName) throw new Error(`Completa el nombre del pasajero ${i + 1}`)
    if (!identification) throw new Error(`Completa la identificación del pasajero ${i + 1}`)
    if (i === 0 && !phone) throw new Error('El teléfono del pasajero de contacto es obligatorio')
    if (i === 0 && !email) throw new Error('El correo del pasajero de contacto es obligatorio')

    if (i === 0) contactEmail = email

    passengers.push({
      fullName,
      identification,
      phone: phone || null,
      email: i === 0 ? email : null,
      isContact: i === 0
    })
  }
  return { passengers, contactEmail }
}

async function submitCheckout(e) {
  e.preventDefault()
  const token = getToken()

  try {
    submitBtn?.setAttribute('disabled', 'true')
    const { passengers, contactEmail } = getPassengersPayload()

    const body = {
      quantity,
      passengers,
      contactEmail
    }
    if (bookingType === 'ROUNDTRIP') {
      body.outboundTripId = outboundTripId
      body.returnTripId = returnTripId
    } else {
      body.tripId = tripId
    }

    const requestBody = JSON.stringify(body)

    const res = token
      ? await fetchWithAuth('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        })
      : await fetch('/api/stripe/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: requestBody
        })

    const payload = await res.json().catch(() => ({}))
    if (res.status === 401) {
      if (token) {
        clearAuth()
        location.replace('/login')
      }
      return
    }
    if (!res.ok || !payload?.url) {
      alert(payload?.error || 'No se pudo iniciar el pago')
      return
    }

    window.location.href = payload.url
  } catch (err) {
    alert(err?.message || 'Error al preparar la compra')
  } finally {
    submitBtn?.removeAttribute('disabled')
  }
}

function init() {
  const isRoundtrip = bookingType === 'ROUNDTRIP'
  const hasValidTrip = isRoundtrip
    ? outboundTripId > 0 && returnTripId > 0
    : tripId > 0

  if (!hasValidTrip || !Number.isInteger(quantity) || quantity <= 0) {
    warningEl.textContent = 'Parámetros de compra inválidos. Vuelve al buscador.'
    submitBtn?.setAttribute('disabled', 'true')
    return
  }

  if (summaryEl) {
    if (isRoundtrip) {
      summaryEl.textContent = `Ida: ${outboundFrom} → ${outboundTo}${outboundRouteCode ? ` · Ruta ${outboundRouteCode}` : ''}${outboundDepartureAt ? ` · ${formatDateTime(outboundDepartureAt)}` : ''} | Vuelta: ${returnFrom} → ${returnTo}${returnRouteCode ? ` · Ruta ${returnRouteCode}` : ''}${returnDepartureAt ? ` · ${formatDateTime(returnDepartureAt)}` : ''}`
    } else {
      summaryEl.textContent = `${tripFrom} → ${tripTo}${routeCode ? ` · Ruta ${routeCode}` : ''}${departureAt ? ` · ${formatDateTime(departureAt)}` : ''}`
    }
  }

  const total = (isRoundtrip ? (outboundUnitPrice + returnUnitPrice) : unitPrice) * quantity
  if (pricingEl) {
    if (isRoundtrip) {
      const perPerson = outboundUnitPrice + returnUnitPrice
      pricingEl.textContent = `Precio por persona: €${perPerson.toFixed(2)} (ida €${outboundUnitPrice.toFixed(2)} + vuelta €${returnUnitPrice.toFixed(2)}) · Total: €${total.toFixed(2)} (${quantity} ${quantity === 1 ? 'persona' : 'personas'})`
    } else {
      pricingEl.textContent = `Precio por persona: €${unitPrice.toFixed(2)} · Total: €${total.toFixed(2)} (${quantity} ${quantity === 1 ? 'persona' : 'personas'})`
    }
  }

  if (seats > 0 && quantity > seats) {
    warningEl.textContent = `La cantidad seleccionada (${quantity}) supera las plazas disponibles (${seats}).`
    submitBtn?.setAttribute('disabled', 'true')
  }

  renderPassengers()
  formEl?.addEventListener('submit', submitCheckout)

  const testBtn = document.getElementById('testPurchaseBtn')
  testBtn?.addEventListener('click', submitTestPurchase)
}

async function submitTestPurchase() {
  const testBtn = document.getElementById('testPurchaseBtn')
  const token = getToken()

  try {
    testBtn?.setAttribute('disabled', 'true')
    const { passengers, contactEmail } = getPassengersPayload()
    const contactPassenger = passengers.find(p => p.isContact) || passengers[0] || {}

    const body = {
      quantity,
      passengers,
      contactEmail,
      contactPhone: contactPassenger.phone || null
    }
    if (bookingType === 'ROUNDTRIP') {
      body.outboundTripId = outboundTripId
      body.returnTripId = returnTripId
    } else {
      body.tripId = tripId
    }

    const requestBody = JSON.stringify(body)

    const res = token
      ? await fetchWithAuth('/api/payments/test-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        })
      : await fetch('/api/payments/test-purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: requestBody
        })

    const payload = await res.json().catch(() => ({}))
    if (res.status === 401) { if (token) { clearAuth(); location.replace('/login') }; return }
    if (!res.ok || !payload?.referenceCode) {
      alert(payload?.error || 'No se pudo crear la compra de prueba')
      return
    }

    sessionStorage.setItem('testPurchaseResult', JSON.stringify(payload))
    window.location.href = '/compra-prueba-exitosa'
  } catch (err) {
    alert(err?.message || 'Error al preparar la compra de prueba')
  } finally {
    testBtn?.removeAttribute('disabled')
  }
}

init()
