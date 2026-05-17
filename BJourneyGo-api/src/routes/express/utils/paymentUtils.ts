import jwt from 'jsonwebtoken'
import { query } from '../../../lib/db'

const JWT_SECRET_PAYMENTS = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'

export function extractOptionalUserId(req: any): number | null {
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

export function parsePositiveInt(value: any): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function resolveTripIds(input: { tripId?: any; outboundTripId?: any; returnTripId?: any }): number[] {
  const outbound = parsePositiveInt(input.outboundTripId || input.tripId)
  const ret = parsePositiveInt(input.returnTripId)
  if (!outbound) throw new Error('outboundTripId/tripId is required')
  if (ret && ret === outbound) throw new Error('returnTripId must be different from outboundTripId')
  return ret ? [outbound, ret] : [outbound]
}

export function resolveCheckoutReturnUrl(candidate: any, fallback: string): string {
  const value = String(candidate || '').trim()
  if (/^(bjourneygo|exp|exps):\/\//i.test(value)) return value
  return fallback
}

export function appendCheckoutSessionId(baseUrl: string): string {
  const separator = baseUrl.includes('?') ? '&' : '?'
  return `${baseUrl}${separator}session_id={CHECKOUT_SESSION_ID}`
}

export type PassengerInput = {
  fullName: string
  identification: string
  phone?: string | null
  email?: string | null
  isContact?: boolean
}

export function normalizePassengers(input: any, quantity: number): PassengerInput[] {
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

export async function buildOrderSummary(orderId: number) {
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
