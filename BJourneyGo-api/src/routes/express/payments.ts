import { Router } from 'express'
import { transaction, query } from '../../lib/db'
import mailer from '../../lib/mailer'
import { buildReceiptEmail } from '../../lib/emailTemplates'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import PDFDocument from 'pdfkit'
import streamBuffers from 'stream-buffers'
import Stripe from 'stripe'

const JWT_SECRET_PAYMENTS = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'

function extractOptionalUserId(req: any): number | null {
  const auth = req.headers?.authorization
  if (!auth) return null
  try {
    const token = String(auth).replace('Bearer ', '')
    const payload: any = jwt.verify(token, JWT_SECRET_PAYMENTS)
    return Number(payload?.userId) || null
  } catch {
    return null
  }
}

const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || ''
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || ''
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || ''
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'EUR').toLowerCase()
const COMMISSION_DEFAULT_PERCENT = Number.parseFloat(process.env.COMMISSION_DEFAULT_PERCENT || '10')

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null

const router = Router()

type PassengerInput = {
  fullName: string
  identification: string
  phone?: string | null
  email?: string | null
  isContact?: boolean
}

function generateReferenceCode(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = crypto.randomBytes(length)
  let code = ''
  for (let i = 0; i < random.length; i++) {
    code += alphabet[random[i] % alphabet.length]
  }
  return `BJ-${code}`
}

function normalizePassengers(input: any, quantity: number): PassengerInput[] {
  if (!Array.isArray(input) || input.length === 0) return []
  const passengers = input.map((p: any, index: number) => {
    const fullName = String(p?.fullName || '').trim()
    const identification = String(p?.identification || '').trim()
    const phone = String(p?.phone || '').trim()
    const email = String(p?.email || '').trim().toLowerCase()
    const isContact = Boolean(p?.isContact) || index === 0
    return { fullName, identification, phone: phone || null, email: email || null, isContact }
  })

  if (passengers.length !== quantity) throw new Error('Passengers count must match quantity')
  for (const p of passengers) {
    if (!p.fullName) throw new Error('Passenger fullName is required')
    if (!p.identification) throw new Error('Passenger identification is required')
  }

  const hasContact = passengers.some(p => p.isContact)
  if (!hasContact && passengers.length > 0) passengers[0].isContact = true
  if (hasContact) {
    let contactAssigned = false
    for (const p of passengers) {
      if (p.isContact && !contactAssigned) {
        contactAssigned = true
        continue
      }
      p.isContact = false
    }
  }

  const contactPassenger = passengers.find(p => p.isContact)
  if (contactPassenger?.email && !/^\S+@\S+\.\S+$/.test(contactPassenger.email)) {
    throw new Error('Contact passenger email is invalid')
  }

  return passengers
}

function parsePositiveInt(value: any): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

function resolveTripIds(input: { tripId?: any; outboundTripId?: any; returnTripId?: any }): number[] {
  const outbound = parsePositiveInt(input.outboundTripId || input.tripId)
  const ret = parsePositiveInt(input.returnTripId)
  if (!outbound) throw new Error('outboundTripId/tripId is required')
  if (ret && ret === outbound) throw new Error('returnTripId must be different from outboundTripId')
  return ret ? [outbound, ret] : [outbound]
}

async function buildOrderSummary(orderId: number) {
  const [orderRows]: any = await query(
    'SELECT id, reference_code AS referenceCode, contact_email AS contactEmail, contact_phone AS contactPhone, total_amount AS total, currency, status FROM `Order` WHERE id = ? LIMIT 1',
    [orderId]
  )
  const order = orderRows && orderRows[0]
  if (!order) return null

  const ticketRows: any = await query(
    `SELECT t.id, t.uuid, t.qr_token AS qrToken, t.passenger_name AS passengerName,
            t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone,
            t.price, t.status,
            DATE_FORMAT(tr.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
            DATE_FORMAT(tr.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
            r.origin, r.destination, r.code AS routeCode
     FROM \`Ticket\` t
     JOIN \`Trip\` tr ON tr.id = t.trip_id
     JOIN \`Route\` r ON r.id = tr.route_id
     WHERE t.order_id = ?
     ORDER BY t.id ASC`,
    [orderId]
  )

  const first = ticketRows && ticketRows[0] ? ticketRows[0] : null
  return {
    orderId: order.id,
    referenceCode: order.referenceCode,
    contactEmail: order.contactEmail,
    contactPhone: order.contactPhone,
    total: Number(order.total || 0),
    currency: order.currency || 'EUR',
    status: order.status || 'PAID',
    trip: first
      ? {
          origin: first.origin || null,
          destination: first.destination || null,
          routeCode: first.routeCode || null,
          departureAt: first.departureAt || null,
          arrivalAt: first.arrivalAt || null,
        }
      : null,
    tickets: (ticketRows || []).map((t: any) => ({
      uuid: t.uuid,
      qrToken: t.qrToken || null,
      passengerName: t.passengerName || null,
      passengerIdentification: t.passengerIdentification || null,
      passengerPhone: t.passengerPhone || null,
      price: Number(t.price || 0),
      status: t.status || null,
    })),
  }
}

async function processPaymentCapture(params: { provider: string; providerRef: string; status: string; amount: number; currency: string; orderId?: number; tripId?: number; outboundTripId?: number; returnTripId?: number; quantity?: number }) {
  const { provider, providerRef, status, amount, currency, orderId, tripId, outboundTripId, returnTripId, quantity } = params
  return transaction(async (tx: any) => {
    const [paymentRows]: any = await tx.query(
      'SELECT id, order_id AS orderId, provider, provider_ref AS providerRef, provider_ref AS providerRefDup, amount, currency, fee, status, created_at AS createdAt, updated_at AS updatedAt, captured_at AS capturedAt, refunded_at AS refundedAt FROM `PaymentRecord` WHERE provider_ref = ? LIMIT 1',
      [providerRef]
    )
    let payment = paymentRows && paymentRows[0]
    if (!payment) {
      const [ins]: any = await tx.query(
        'INSERT INTO `PaymentRecord` (provider, provider_ref, amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
        [provider, providerRef, amount ? Number(amount) : 0, currency || 'EUR', status]
      )
      const pid = ins.insertId
      const [pRows]: any = await tx.query(
        'SELECT id, order_id AS orderId, provider, provider_ref AS providerRef, amount, currency, fee, status, created_at AS createdAt, updated_at AS updatedAt FROM `PaymentRecord` WHERE id = ? LIMIT 1',
        [pid]
      )
      payment = pRows && pRows[0]
    } else {
      await tx.query(
        'UPDATE `PaymentRecord` SET status = ?, amount = ?, currency = ?, updated_at = NOW() WHERE id = ?',
        [status, amount ? Number(amount) : payment.amount, currency || payment.currency, payment.id]
      )
    }

    if (status === 'CAPTURED' && orderId) {
      const qty = Number(quantity || 0)
      const legacyTripId = Number(tripId || 0)
      const outboundId = Number(outboundTripId || legacyTripId || 0)
      const returnId = Number(returnTripId || 0)
      const captureTripIds = returnId ? [outboundId, returnId] : [outboundId]

      const [ticketCountRows]: any = await tx.query('SELECT COUNT(1) AS total FROM `Ticket` WHERE order_id = ? LIMIT 1', [orderId])
      const existingTickets = Number(ticketCountRows?.[0]?.total || 0)

      if (existingTickets === 0) {
        if (qty <= 0 || captureTripIds.some((id) => !id)) {
          throw new Error('trip ids and quantity required for capture')
        }

        const placeholders = captureTripIds.map(() => '?').join(',')
        const [tripRows]: any = await tx.query(
          `SELECT id, base_price AS basePrice FROM \`Trip\` WHERE id IN (${placeholders})`,
          captureTripIds
        )
        const tripsById = new Map<number, any>()
        for (const tr of (tripRows || [])) tripsById.set(Number(tr.id), tr)
        for (const tripIdItem of captureTripIds) {
          if (!tripsById.has(Number(tripIdItem))) throw new Error('Trip not found')
        }

        const [orderPassengerRows]: any = await tx.query(
          'SELECT passenger_index AS passengerIndex, full_name AS fullName, identification, phone, is_contact AS isContact FROM `OrderPassenger` WHERE order_id = ? ORDER BY passenger_index ASC',
          [orderId]
        )
        const passengers = Array.isArray(orderPassengerRows) ? orderPassengerRows : []

        for (const tripIdItem of captureTripIds) {
          const [updatedRows]: any = await tx.query(
            'UPDATE `Trip` SET seats_sold = seats_sold + ? WHERE id = ? AND seats_sold + ? <= capacity',
            [qty, tripIdItem, qty]
          )
          const updated = (updatedRows && (updatedRows.affectedRows ?? updatedRows.affected_rows ?? 0)) || 0
          if (updated === 0) throw new Error('Not enough seats available')

          const trip = tripsById.get(Number(tripIdItem))
          const ticketPlaceholders = Array.from({ length: qty }).map(() => '(UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())').join(',')
          const flat: any[] = []
          for (let i = 0; i < qty; i++) {
            const p = passengers[i] || null
            flat.push(
              orderId,
              Number(tripIdItem),
              p?.fullName || null,
              p?.identification || null,
              p?.phone || null,
              p?.isContact ? 1 : 0,
              trip.basePrice
            )
          }
          await tx.query(
            'INSERT INTO `Ticket` (uuid, order_id, trip_id, passenger_name, passenger_identification, passenger_phone, is_contact, price, issued_at) VALUES ' + ticketPlaceholders,
            flat
          )
        }
      }

      await tx.query('UPDATE `Order` SET status = ? WHERE id = ?', ['PAID', Number(orderId)])
      const [tickets]: any = await tx.query('SELECT id, uuid, qr_token AS qrToken, trip_id AS tripId FROM `Ticket` WHERE order_id = ?', [orderId])
      for (const t of tickets) {
        if (!t.qrToken) {
          const token = JSON.stringify({ ticketUuid: t.uuid, tripId: t.tripId })
          await tx.query('UPDATE `Ticket` SET qr_token = ? WHERE id = ?', [token, t.id])
        }
      }

      // send receipt email to purchaser if possible
      try {
          const [orderRows]: any = await tx.query('SELECT o.id, o.user_id AS userId, o.total_amount AS totalAmount, o.currency, o.reference_code AS referenceCode, o.contact_email AS contactEmail FROM `Order` o WHERE o.id = ? LIMIT 1', [orderId])
        const order = orderRows && orderRows[0]
        if (order) {
          const [userRows]: any = await tx.query('SELECT id, email, name FROM `User` WHERE id = ? LIMIT 1', [order.userId])
          const user = userRows && userRows[0]
            const [ticketRows]: any = await tx.query('SELECT uuid, qr_token AS qrToken FROM `Ticket` WHERE order_id = ?', [orderId])
            const ticketList = (ticketRows || []).map((r: any) => ({ uuid: r.uuid, qr: r.qrToken }))
            const receipt = buildReceiptEmail(orderId, order.totalAmount, order.currency, ticketList, order.referenceCode || null)

            const recipients = Array.from(new Set([
              String(order.contactEmail || '').trim().toLowerCase(),
              String(user?.email || '').trim().toLowerCase()
            ].filter(Boolean)))

            if (recipients.length > 0) {

              try {
                const doc = new PDFDocument()
                const bufferStream = new streamBuffers.WritableStreamBuffer({ initialSize: (100 * 1024), incrementAmount: (10 * 1024) })
                doc.fontSize(16).text('Recibo de compra', { align: 'center' })
                doc.moveDown()
                doc.fontSize(12).text(`Pedido #${orderId}`)
                doc.text(`Total: ${order.totalAmount} ${order.currency}`)
                if (order.referenceCode) {
                  doc.text(`Referencia: ${order.referenceCode}`)
                }
                doc.moveDown()
                doc.text('Billetes:')
                ticketList.forEach((t: any) => {
                  doc.text(`- ${t.uuid}`)
                })
                doc.end()
                doc.pipe(bufferStream)
                await new Promise((resolve) => doc.on('end', resolve))
                const pdfBuffer = bufferStream.getContents()
                const pdfBase64 = pdfBuffer.toString('base64')
                for (const email of recipients) {
                  await mailer.sendMail({ to: email, subject: receipt.subject, html: receipt.html, text: receipt.text, attachments: [{ Filename: `receipt-${orderId}.pdf`, ContentType: 'application/pdf', Content: pdfBase64 }] })
                }
              } catch (e) {
                for (const email of recipients) {
                  await mailer.sendMail({ to: email, subject: receipt.subject, html: receipt.html, text: receipt.text })
                }
            }
          }
        }
      } catch (e) {
        console.warn('Failed to send purchase receipt email', e)
      }
    }

    return { ok: true, payment }
  })
}

router.post('/reconcile', async (req: any, res) => {
  // Optional webhook signature verification
  try {
    if (PAYMENT_WEBHOOK_SECRET) {
      const sig = req.headers['x-payment-signature'] || req.headers['X-Payment-Signature']
      const payload = JSON.stringify(req.body || {})
      const h = crypto.createHmac('sha256', PAYMENT_WEBHOOK_SECRET).update(payload).digest('hex')
      if (!sig || String(sig) !== h) return res.status(400).json({ error: 'invalid signature' })
    }
  } catch (e) {
    // proceed silently if verification fails to compute
  }

  const { provider, providerRef, status, amount, currency, orderId, tripId, outboundTripId, returnTripId, quantity } = req.body || {}
  if (!provider || !providerRef || !status) return res.status(400).json({ error: 'provider, providerRef and status required' })

  try {
    const result = await processPaymentCapture({
      provider,
      providerRef,
      status,
      amount,
      currency,
      orderId,
      tripId,
      outboundTripId,
      returnTripId,
      quantity,
    })
    res.json(result)
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

router.post('/stripe/checkout', async (req: any, res) => {
  const { quantity = 1, passengers: rawPassengers = [], contactEmail: rawContactEmail = '' } = req.body || {}
  const qty = Number(quantity)
  if (!stripe) return res.status(500).json({ error: 'stripe not configured' })
  if (!STRIPE_SUCCESS_URL || !STRIPE_CANCEL_URL) return res.status(500).json({ error: 'stripe urls not configured' })
  if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'positive integer quantity required' })

  const userId = extractOptionalUserId(req)

  try {
    const selectedTripIds = resolveTripIds(req.body || {})
    const outboundTripId = selectedTripIds[0]
    const returnTripId = selectedTripIds[1] || 0
    const passengers = normalizePassengers(rawPassengers, qty)
    const explicitContactEmail = String(rawContactEmail || '').trim().toLowerCase()
    if (explicitContactEmail && !/^\S+@\S+\.\S+$/.test(explicitContactEmail)) {
      throw new Error('contactEmail is invalid')
    }
    const contactPassenger = passengers.find((p) => p.isContact) || passengers[0] || null
    const contactEmail = explicitContactEmail || String(contactPassenger?.email || '').trim().toLowerCase()
    const contactPhone = String(contactPassenger?.phone || '').trim()
    if (!contactEmail) throw new Error('El correo del contacto es obligatorio')

    let referenceCode = ''

    const result = await transaction(async (tx: any) => {
      const placeholders = selectedTripIds.map(() => '?').join(',')
      const [tripRows]: any = await tx.query(
        `SELECT t.id, t.route_id AS routeId, t.bus_id AS busId,
                DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
                DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
                t.status, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice,
                r.origin, r.destination, r.code AS routeCode, r.agency_id AS agencyId,
                a.stripe_account_id AS agencyStripeAccountId, a.commission_percent AS commissionPercent,
                a.payout_active AS payoutActive
         FROM \`Trip\` t
         JOIN \`Route\` r ON r.id = t.route_id
         LEFT JOIN \`Agency\` a ON a.id = r.agency_id
         WHERE t.id IN (${placeholders})`,
        selectedTripIds
      )
      const trips = Array.isArray(tripRows) ? tripRows : []
      const byId = new Map<number, any>()
      for (const tr of trips) byId.set(Number(tr.id), tr)
      for (const tripIdItem of selectedTripIds) {
        const trip = byId.get(Number(tripIdItem))
        if (!trip) throw new Error('Trip not found')
        const seatsLeft = Number(trip.capacity || 0) - Number(trip.seatsSold || 0)
        if (seatsLeft < qty) throw new Error('Not enough seats available')
      }

      const orderedTrips = selectedTripIds.map((id) => byId.get(Number(id))).filter(Boolean)
      const total = orderedTrips.reduce((acc: number, tr: any) => acc + Number(tr.basePrice || 0), 0) * qty
      const currency = STRIPE_CURRENCY.toUpperCase()
      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateReferenceCode()
        const [dupRows]: any = await tx.query('SELECT id FROM `Order` WHERE reference_code = ? LIMIT 1', [candidate])
        if (!dupRows || dupRows.length === 0) {
          referenceCode = candidate
          break
        }
      }
      if (!referenceCode) throw new Error('No se pudo generar una referencia válida')

      const [ins]: any = await tx.query(
        'INSERT INTO `Order` (user_id, reference_code, contact_email, contact_phone, total_amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [userId, referenceCode, contactEmail, contactPhone || null, total, currency, 'PENDING']
      )
      const orderId = ins.insertId

      if (passengers.length > 0) {
        const placeholders = passengers.map(() => '(?, ?, ?, ?, ?, ?, NOW(), NOW())').join(',')
        const values: any[] = []
        passengers.forEach((p, index) => {
          values.push(orderId, index, p.fullName, p.identification, p.phone || null, p.isContact ? 1 : 0)
        })
        await tx.query(
          'INSERT INTO `OrderPassenger` (order_id, passenger_index, full_name, identification, phone, is_contact, created_at, updated_at) VALUES ' + placeholders,
          values
        )
      }

      return { orderId, total, currency, trips: orderedTrips, referenceCode }
    })

    const orderedTrips = Array.isArray(result.trips) ? result.trips : []
    const outboundTrip = orderedTrips[0]
    const totalCents = Math.round(Number(result.total) * 100)
    const rawCommission = Number.isFinite(Number(outboundTrip?.commissionPercent)) ? Number(outboundTrip?.commissionPercent) : COMMISSION_DEFAULT_PERCENT
    const commissionPercent = Math.min(100, Math.max(0, rawCommission))
    const feeCents = Math.max(0, Math.min(totalCents, Math.round(totalCents * (commissionPercent / 100))))
    const hasDestination = Boolean(outboundTrip?.agencyStripeAccountId && outboundTrip?.payoutActive)

    const lineItems = orderedTrips.map((trip: any, index: number) => ({
      quantity: qty,
      price_data: {
        currency: STRIPE_CURRENCY,
        unit_amount: Math.round(Number(trip.basePrice) * 100),
        product_data: {
          name: index === 0
            ? `Billete ida ${trip.origin} - ${trip.destination}`
            : `Billete vuelta ${trip.origin} - ${trip.destination}`,
          description: `Ruta ${trip.routeCode || ''} · Salida ${trip.departureAt || ''}`
        }
      }
    }))

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${STRIPE_SUCCESS_URL}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${STRIPE_CANCEL_URL}?session_id={CHECKOUT_SESSION_ID}`,
      ...(hasDestination ? {
        payment_intent_data: {
          application_fee_amount: feeCents,
          transfer_data: {
            destination: outboundTrip.agencyStripeAccountId,
          }
        }
      } : {}),
      metadata: {
        orderId: String(result.orderId),
        userId: userId ? String(userId) : '',
        tripId: String(outboundTripId),
        outboundTripId: String(outboundTripId),
        returnTripId: returnTripId ? String(returnTripId) : '',
        quantity: String(qty),
        agencyId: outboundTrip?.agencyId ? String(outboundTrip.agencyId) : '',
        commissionPercent: String(commissionPercent),
        payoutActive: String(Boolean(outboundTrip?.payoutActive)),
        tripType: returnTripId ? 'ROUNDTRIP' : 'ONEWAY'
      }
    })

    await query(
      'INSERT INTO `PaymentRecord` (order_id, provider, provider_ref, amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [result.orderId, 'stripe', session.id, result.total, result.currency, 'PENDING']
    )

    res.json({ success: true, url: session.url, sessionId: session.id, orderId: result.orderId, referenceCode: result.referenceCode })
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

router.post('/stripe/confirm', async (req: any, res) => {
  const { sessionId } = req.body || {}
  if (!stripe) return res.status(500).json({ error: 'stripe not configured' })
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' })

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (!session) return res.status(404).json({ error: 'session not found' })
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'payment not completed', status: session.payment_status })
    }

    const orderId = Number(session.metadata?.orderId || 0)
    if (!orderId) return res.status(400).json({ error: 'orderId missing' })
    const tripId = Number(session.metadata?.tripId || 0)
    const outboundTripId = Number(session.metadata?.outboundTripId || tripId || 0)
    const returnTripId = Number(session.metadata?.returnTripId || 0)
    const quantity = Number(session.metadata?.quantity || 0)

    const amount = session.amount_total ? session.amount_total / 100 : 0
    const currency = (session.currency || STRIPE_CURRENCY || 'eur').toUpperCase()
    const result = await processPaymentCapture({
      provider: 'stripe',
      providerRef: session.id,
      status: 'CAPTURED',
      amount,
      currency,
      orderId,
      tripId,
      outboundTripId,
      returnTripId,
      quantity
    })
    const purchase = await buildOrderSummary(orderId)
    res.json({ success: true, purchase, ...result })
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

// ── TEST ONLY ── bypasses Stripe for local/dev checkin testing ─────────────
router.post('/test-purchase', async (req: any, res) => {
  if (process.env.DISABLE_TEST_PURCHASE === 'true') {
    return res.status(403).json({ error: 'Test endpoints are not available' })
  }

  const {
    quantity = 1,
    passengers: rawPassengers = [],
    contactEmail: rawContactEmail = '',
    contactPhone: rawContactPhone = ''
  } = req.body || {}

  const qty = Number(quantity)
  if (!Number.isInteger(qty) || qty <= 0) {
    return res.status(400).json({ error: 'positive integer quantity required' })
  }

  const userId = extractOptionalUserId(req)

  try {
    const selectedTripIds = resolveTripIds(req.body || {})
    const passengers = normalizePassengers(rawPassengers, qty)
    const contactEmail = String(rawContactEmail || '').trim().toLowerCase()
    const contactPhone = String(rawContactPhone || '').trim()
    if (!contactEmail) throw new Error('contactEmail is required')

    let referenceCode = ''

    const result = await transaction(async (tx: any) => {
      const placeholders = selectedTripIds.map(() => '?').join(',')
      const [tripRows]: any = await tx.query(
        `SELECT t.id,
                DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
                DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
                t.capacity,
                t.seats_sold AS seatsSold,
                t.base_price AS basePrice,
                r.origin,
                r.destination,
                r.code AS routeCode
         FROM \`Trip\` t
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE t.id IN (${placeholders})`,
        selectedTripIds
      )
      const trips = Array.isArray(tripRows) ? tripRows : []
      const byId = new Map<number, any>()
      for (const tr of trips) byId.set(Number(tr.id), tr)
      for (const tripIdItem of selectedTripIds) {
        const trip = byId.get(Number(tripIdItem))
        if (!trip) throw new Error('Trip not found')
        const seatsLeft = Number(trip.capacity || 0) - Number(trip.seatsSold || 0)
        if (seatsLeft < qty) throw new Error('Not enough seats available')
      }

      const orderedTrips = selectedTripIds.map((id) => byId.get(Number(id))).filter(Boolean)
      const total = orderedTrips.reduce((acc: number, tr: any) => acc + Number(tr.basePrice || 0), 0) * qty
      const currency = 'EUR'

      for (let attempt = 0; attempt < 5; attempt++) {
        const candidate = generateReferenceCode()
        const [dupRows]: any = await tx.query('SELECT id FROM `Order` WHERE reference_code = ? LIMIT 1', [candidate])
        if (!dupRows || dupRows.length === 0) { referenceCode = candidate; break }
      }
      if (!referenceCode) throw new Error('No se pudo generar una referencia válida')

      const [ins]: any = await tx.query(
        'INSERT INTO `Order` (user_id, reference_code, contact_email, contact_phone, total_amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [userId, referenceCode, contactEmail, contactPhone || null, total, currency, 'PAID']
      )
      const orderId = ins.insertId

      if (passengers.length > 0) {
        const pHolds = passengers.map(() => '(?, ?, ?, ?, ?, ?, NOW(), NOW())').join(',')
        const pVals: any[] = []
        passengers.forEach((p, index) => {
          pVals.push(orderId, index, p.fullName, p.identification, p.phone || null, p.isContact ? 1 : 0)
        })
        await tx.query(
          'INSERT INTO `OrderPassenger` (order_id, passenger_index, full_name, identification, phone, is_contact, created_at, updated_at) VALUES ' + pHolds,
          pVals
        )
      }

      for (const tripIdItem of selectedTripIds) {
        await tx.query('UPDATE `Trip` SET seats_sold = seats_sold + ? WHERE id = ?', [qty, Number(tripIdItem)])

        const trip = byId.get(Number(tripIdItem))
        const tHolds = Array.from({ length: qty }).map(() => '(UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())').join(',')
        const tVals: any[] = []
        for (let i = 0; i < qty; i++) {
          const p = passengers[i] || null
          tVals.push(orderId, Number(tripIdItem), p?.fullName || null, p?.identification || null, p?.phone || null, p?.isContact ? 1 : 0, trip.basePrice)
        }
        await tx.query(
          'INSERT INTO `Ticket` (uuid, order_id, trip_id, passenger_name, passenger_identification, passenger_phone, is_contact, price, issued_at) VALUES ' + tHolds,
          tVals
        )
      }

      const [rawTickets]: any = await tx.query('SELECT id, uuid, trip_id AS tripId FROM `Ticket` WHERE order_id = ?', [orderId])
      const ticketList: any[] = []
      for (const t of rawTickets) {
        const token = JSON.stringify({ ticketUuid: t.uuid, tripId: t.tripId })
        await tx.query('UPDATE `Ticket` SET qr_token = ? WHERE id = ?', [token, t.id])
        ticketList.push({ uuid: t.uuid, qrToken: token })
      }

      return {
        orderId,
        referenceCode,
        contactEmail,
        contactPhone,
        total,
        currency,
        trips: orderedTrips,
        tickets: ticketList
      }
    })

    res.json({
      success: true,
      orderId: result.orderId,
      referenceCode: result.referenceCode,
      contactEmail: result.contactEmail,
      contactPhone: result.contactPhone || null,
      total: result.total,
      currency: result.currency,
      trip: result.trips?.[0] || null,
      trips: result.trips || [],
      tickets: result.tickets
    })

    // Fire-and-forget receipt email (same as real Stripe purchase)
    ;(async () => {
      try {
        const ticketList = result.tickets.map((t: any) => ({ uuid: t.uuid, qr: t.qrToken }))
        const receipt = buildReceiptEmail(result.orderId, result.total, result.currency, ticketList, result.referenceCode)
        const recipients = new Set<string>([result.contactEmail].filter(Boolean))
        if (userId) {
          const userRows: any = await query('SELECT email FROM `User` WHERE id = ? LIMIT 1', [userId])
          const ue = userRows?.[0]?.email
          if (ue) recipients.add(String(ue).trim().toLowerCase())
        }
        for (const email of recipients) {
          await mailer.sendMail({ to: email, subject: receipt.subject, html: receipt.html, text: receipt.text })
        }
      } catch (e) {
        console.warn('test-purchase: failed to send receipt email', e)
      }
    })()
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

// ── GET /tickets/:uuid/pdf  ─── download ticket as PDF ──────────────────────
router.get('/tickets/:uuid/pdf', async (req: any, res) => {
  const uuid = String(req.params.uuid || '').trim()
  if (!uuid) return res.status(400).json({ error: 'uuid required' })

  // Optional auth — allow token in query param for direct link downloads
  let requestUserId: number | null = extractOptionalUserId(req)
  if (!requestUserId) {
    const qToken = String(req.query.token || '')
    if (qToken) {
      try {
        const p: any = jwt.verify(qToken, JWT_SECRET_PAYMENTS)
        requestUserId = Number(p?.userId) || null
      } catch {}
    }
  }

  try {
    const rows: any = await query(
      `SELECT t.uuid, t.qr_token AS qrToken, t.passenger_name AS passengerName,
              t.passenger_identification AS passengerIdentification,
              t.passenger_phone AS passengerPhone, t.status, t.price,
              t.issued_at AS issuedAt,
              DATE_FORMAT(tr.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(tr.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
              r.origin, r.destination, r.code AS routeCode,
              o.id AS orderId, o.reference_code AS referenceCode, o.user_id AS ownerUserId,
              o.currency
       FROM \`Ticket\` t
       JOIN \`Trip\` tr ON tr.id = t.trip_id
       JOIN \`Route\` r ON r.id = tr.route_id
       JOIN \`Order\` o ON o.id = t.order_id
       WHERE t.uuid = ? LIMIT 1`,
      [uuid]
    )
    const ticket = rows && rows[0]
    if (!ticket) return res.status(404).json({ error: 'ticket not found' })

    // Access control: owner or staff
    if (requestUserId !== ticket.ownerUserId) {
      const role = (req.user || (() => {
        try { return jwt.verify(String(req.headers?.authorization || '').replace('Bearer ', ''), JWT_SECRET_PAYMENTS) as any } catch { return null }
      })())?.role
      const isStaff = role === 'ADMIN' || role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER'
      if (!isStaff) return res.status(403).json({ error: 'forbidden' })
    }

    const parseLocalDateTime = (value: any) => {
      const raw = String(value || '').trim()
      if (!raw) return new Date(NaN)
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})(?::(\d{2}))?$/)
      if (m) {
        const [, y, mo, d, h, mi, s] = m
        return new Date(
          Number(y),
          Number(mo) - 1,
          Number(d),
          Number(h),
          Number(mi),
          Number(s || '0')
        )
      }
      const parsed = new Date(raw)
      return parsed
    }

    const fmtDate = (v: any) => {
      if (!v) return '—'
      try {
        const d = parseLocalDateTime(v)
        if (Number.isNaN(d.getTime())) return String(v)
        return d.toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
      } catch {
        return String(v)
      }
    }

    const doc = new PDFDocument({ size: 'A5', margins: { top: 40, bottom: 40, left: 40, right: 40 } })
    const buf = new streamBuffers.WritableStreamBuffer({ initialSize: 200 * 1024, incrementAmount: 50 * 1024 })
    doc.pipe(buf)

    const BRAND = process.env.EMAIL_BRAND_NAME || 'BJourneyGo'
    doc.fontSize(18).font('Helvetica-Bold').text(BRAND, { align: 'center' })
    doc.fontSize(11).font('Helvetica').text('Billete de viaje', { align: 'center' })
    doc.moveDown(0.5)
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
    doc.moveDown(0.5)

    doc.fontSize(14).font('Helvetica-Bold').text(`${ticket.origin || '-'}  -  ${ticket.destination || '-'}`, { align: 'center' })
    doc.moveDown(0.3)
    if (ticket.routeCode) doc.fontSize(10).font('Helvetica').text(`Código de ruta: ${ticket.routeCode}`, { align: 'center' })
    if (ticket.departureAt) doc.fontSize(10).text(`Salida: ${fmtDate(ticket.departureAt)}`, { align: 'center' })
    if (ticket.arrivalAt) doc.fontSize(10).text(`Llegada: ${fmtDate(ticket.arrivalAt)}`, { align: 'center' })
    doc.moveDown(0.5)

    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
    doc.moveDown(0.5)

    doc.fontSize(11).font('Helvetica-Bold').text('Datos del pasajero')
    doc.font('Helvetica').fontSize(10)
    doc.text(`Nombre: ${ticket.passengerName || '—'}`)
    doc.text(`DNI / Identificación: ${ticket.passengerIdentification || '—'}`)
    if (ticket.passengerPhone) doc.text(`Teléfono: ${ticket.passengerPhone}`)
    doc.moveDown(0.5)

    doc.font('Helvetica-Bold').fontSize(11).text('Reserva')
    doc.font('Helvetica').fontSize(10)
    if (ticket.referenceCode) doc.text(`Referencia: ${ticket.referenceCode}`)
    doc.text(`Precio: ${ticket.price} ${ticket.currency || 'EUR'}`)
    if (ticket.issuedAt) doc.text(`Emitido: ${fmtDate(ticket.issuedAt)}`)
    doc.moveDown(0.5)

    // Embed QR via quickchart.io
    try {
      const qrText = ticket.qrToken || ticket.uuid
      const qrUrl = `https://quickchart.io/qr?size=200&margin=1&text=${encodeURIComponent(qrText)}`
      const qrRes = await fetch(qrUrl, { signal: AbortSignal.timeout(8000) })
      if (qrRes.ok) {
        const qrBuf = Buffer.from(await qrRes.arrayBuffer())
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke()
        doc.moveDown(0.5)
        const imgX = (doc.page.width - 150) / 2
        doc.image(qrBuf, imgX, doc.y, { width: 150 })
        doc.moveDown(8)
        doc.fontSize(9).text('Presenta este QR al embarcar', { align: 'center' })
      }
    } catch (_e) {
      doc.text('[QR no disponible]', { align: 'center' })
    }

    doc.end()
    await new Promise<void>((resolve) => doc.on('end', resolve))
    const pdfBuffer = buf.getContents()
    if (!pdfBuffer) return res.status(500).json({ error: 'pdf generation failed' })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="ticket-${uuid.slice(0, 8)}.pdf"`)
    res.setHeader('Content-Length', String(pdfBuffer.length))
    res.send(pdfBuffer)
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
