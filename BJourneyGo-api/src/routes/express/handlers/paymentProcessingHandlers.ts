import crypto from 'crypto'
import PDFDocument from 'pdfkit'
import streamBuffers from 'stream-buffers'
import { query, transaction } from '../../../lib/db'
import { buildReceiptEmail } from '../../../lib/emailTemplates'
import mailer from '../../../lib/mailer'
import { extractOptionalUserId, normalizePassengers, resolveTripIds } from '../utils/paymentUtils'

const PAYMENT_WEBHOOK_SECRET = process.env.PAYMENT_WEBHOOK_SECRET || ''

function generateReferenceCode(length = 10): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const random = crypto.randomBytes(length)
  let code = ''
  for (let i = 0; i < random.length; i++) {
    code += alphabet[random[i] % alphabet.length]
  }
  return `BJ-${code}`
}

export async function processPaymentCapture(params: { provider: string; providerRef: string; status: string; amount: number; currency: string; orderId?: number; tripId?: number; outboundTripId?: number; returnTripId?: number; quantity?: number }) {
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

export function registerPaymentProcessingHandlers(router: any) {
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
}
