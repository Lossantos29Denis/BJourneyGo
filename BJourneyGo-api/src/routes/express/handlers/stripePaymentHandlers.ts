import Stripe from 'stripe'
import { query, transaction } from '../../../lib/db'
import { appendCheckoutSessionId, buildOrderSummary, extractOptionalUserId, normalizePassengers, resolveCheckoutReturnUrl, resolveTripIds } from '../utils/paymentUtils'
import { processPaymentCapture } from './paymentProcessingHandlers'

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || ''
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || ''
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL || ''
const STRIPE_CURRENCY = (process.env.STRIPE_CURRENCY || 'EUR').toLowerCase()
const COMMISSION_DEFAULT_PERCENT = Number.parseFloat(process.env.COMMISSION_DEFAULT_PERCENT || '10')

const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' }) : null

function generateReferenceCode(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = require('crypto').randomBytes(length)
  let code = ''
  for (let i = 0; i < random.length; i++) {
    code += alphabet[random[i] % alphabet.length]
  }
  return `BJ-${code}`
}

export function registerStripePaymentHandlers(router: any) {
  router.post('/stripe/checkout', async (req: any, res) => {
    const { quantity = 1, passengers: rawPassengers = [], contactEmail: rawContactEmail = '', successUrl: rawSuccessUrl = '', cancelUrl: rawCancelUrl = '' } = req.body || {}
    const qty = Number(quantity)
    if (!stripe) return res.status(500).json({ error: 'stripe not configured' })
    if (!STRIPE_SUCCESS_URL || !STRIPE_CANCEL_URL) return res.status(500).json({ error: 'stripe urls not configured' })
    if (!Number.isInteger(qty) || qty <= 0) return res.status(400).json({ error: 'positive integer quantity required' })

    const successUrl = resolveCheckoutReturnUrl(rawSuccessUrl, STRIPE_SUCCESS_URL)
    const cancelUrl = resolveCheckoutReturnUrl(rawCancelUrl, STRIPE_CANCEL_URL)

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
        success_url: appendCheckoutSessionId(successUrl),
        cancel_url: appendCheckoutSessionId(cancelUrl),
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
}
