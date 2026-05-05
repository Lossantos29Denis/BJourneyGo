import { Router } from 'express'
import { query, transaction } from '../../lib/db'
import { authenticate } from '../../server/middleware'

const router = Router()

function parsePositiveInt(value: any): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

router.post('/purchase', authenticate, async (req: any, res) => {
  const { tripId, quantity = 1, paymentProvider, providerRef } = req.body || {}
  if (!tripId || quantity <= 0) return res.status(400).json({ error: 'tripId and positive quantity required' })
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: 'unauthorized' })

  try {
    const result = await transaction(async (tx: any) => {
      const [tripRows]: any = await tx.query('SELECT id, route_id AS routeId, bus_id AS busId, departure_at AS departureAt, arrival_at AS arrivalAt, status, capacity, seats_sold AS seatsSold, base_price AS basePrice FROM `Trip` WHERE id = ? LIMIT 1', [tripId])
      const trip = (tripRows && tripRows[0]) || null
      if (!trip) throw new Error('Trip not found')

      const [updatedRows]: any = await tx.query('UPDATE `Trip` SET seats_sold = seats_sold + ? WHERE id = ? AND seats_sold + ? <= capacity', [Number(quantity), Number(tripId), Number(quantity)])
      const updated = (updatedRows && (updatedRows.affectedRows ?? updatedRows.affected_rows ?? 0)) || 0
      if (updated === 0) throw new Error('Not enough seats available')

      const total = Number(trip.basePrice) * Number(quantity)
      const [ins]: any = await tx.query('INSERT INTO `Order` (user_id, total_amount, status, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())', [userId, total, 'PENDING'])
      const orderId = ins.insertId

      const ticketsCount = Number(quantity)
      if (ticketsCount > 0) {
        // Insert tickets generating a UUID() in the database and set issued_at to NOW()
        // We insert one row per ticket using the same price.
        const placeholders = Array.from({ length: ticketsCount }).map(() => '(UUID(), ?, ?, ?, NOW())').join(',')
        const flat: any[] = []
        for (let i = 0; i < ticketsCount; i++) {
          flat.push(orderId, tripId, trip.basePrice)
        }
        await tx.query(`INSERT INTO \`Ticket\` (uuid, order_id, trip_id, price, issued_at) VALUES ${placeholders}`, flat)
      }

      try {
        await tx.query('INSERT INTO `PaymentRecord` (order_id, provider, provider_ref, amount, currency, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', [orderId, paymentProvider || 'unknown', providerRef || null, total, 'USD', 'PENDING'])
      } catch (e) {
        // ignore
      }

      return { orderId }
    })

    res.json(result)
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

router.get('/my', authenticate, async (req: any, res) => {
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: 'unauthorized' })
  try {
    const rows: any = await query(
      `SELECT o.id, o.reference_code AS referenceCode, o.contact_email AS contactEmail,
              o.contact_phone AS contactPhone, o.total_amount AS totalAmount, o.currency,
              o.status, o.created_at AS createdAt,
              t.id AS ticketId, t.uuid AS ticketUuid, t.status AS ticketStatus,
              t.price, t.issued_at AS issuedAt, t.verified_at AS verifiedAt,
              t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification,
              t.qr_token AS qrToken,
              DATE_FORMAT(tr.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(tr.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
              r.origin, r.destination, r.code AS routeCode,
              a.name AS agencyName
       FROM \`Order\` o
       LEFT JOIN \`Ticket\` t ON t.order_id = o.id
       LEFT JOIN \`Trip\` tr ON tr.id = t.trip_id
       LEFT JOIN \`Route\` r ON r.id = tr.route_id
            LEFT JOIN \`Agency\` a ON a.id = r.agency_id
       WHERE o.user_id = ?
       ORDER BY o.created_at DESC, t.id ASC`,
      [userId]
    )

    // Group flat rows into orders with nested tickets array
    const ordersMap = new Map<number, any>()
    for (const row of (rows || [])) {
      if (!ordersMap.has(row.id)) {
        ordersMap.set(row.id, {
          id: row.id,
          referenceCode: row.referenceCode,
          contactEmail: row.contactEmail,
          contactPhone: row.contactPhone,
          totalAmount: row.totalAmount,
          currency: row.currency,
          status: row.status,
          createdAt: row.createdAt,
          tickets: [],
        })
      }
      if (row.ticketId) {
        ordersMap.get(row.id).tickets.push({
          id: row.ticketId,
          uuid: row.ticketUuid,
          status: row.ticketStatus,
          price: row.price,
          issuedAt: row.issuedAt,
          verifiedAt: row.verifiedAt,
          passengerName: row.passengerName,
          passengerIdentification: row.passengerIdentification,
          qrToken: row.qrToken,
          departureAt: row.departureAt,
          arrivalAt: row.arrivalAt,
          origin: row.origin,
          destination: row.destination,
          routeCode: row.routeCode,
          agencyName: row.agencyName,
        })
      }
    }

    res.json({ orders: Array.from(ordersMap.values()) })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.get('/tickets/:uuid/alternatives', authenticate, async (req: any, res) => {
  const ticketUuid = String(req.params.uuid || '').trim()
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: 'unauthorized' })
  if (!ticketUuid) return res.status(400).json({ error: 'uuid required' })

  try {
    const ticketRows: any = await query(
      `SELECT t.id, t.uuid, t.trip_id AS tripId, t.status,
              tr.route_id AS routeId,
              DATE_FORMAT(tr.departure_at, '%Y-%m-%d %H:%i:%s') AS currentDepartureAt,
              DATE_FORMAT(tr.arrival_at, '%Y-%m-%d %H:%i:%s') AS currentArrivalAt,
              r.code AS routeCode, r.origin, r.destination
       FROM \`Ticket\` t
       JOIN \`Order\` o ON o.id = t.order_id
       JOIN \`Trip\` tr ON tr.id = t.trip_id
       JOIN \`Route\` r ON r.id = tr.route_id
       WHERE t.uuid = ? AND o.user_id = ?
       LIMIT 1`,
      [ticketUuid, userId]
    )
    const ticket = ticketRows && ticketRows[0]
    if (!ticket) return res.status(404).json({ error: 'ticket not found' })

    const status = String(ticket.status || '').toUpperCase()
    if (status !== 'ACTIVE') {
      return res.status(400).json({ error: 'only active tickets can be modified' })
    }

    const daysRaw = Number(req.query?.days || 7)
    const days = Number.isFinite(daysRaw) ? Math.min(30, Math.max(1, Math.floor(daysRaw))) : 7

    const alternatives: any = await query(
      `SELECT tr.id,
              DATE_FORMAT(tr.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
              DATE_FORMAT(tr.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
              tr.status,
              tr.capacity,
              tr.seats_sold AS seatsSold,
              tr.base_price AS basePrice,
              r.code AS routeCode,
              r.origin,
              r.destination
       FROM \`Trip\` tr
       JOIN \`Route\` r ON r.id = tr.route_id
       WHERE tr.route_id = ?
         AND tr.id <> ?
         AND NOT (tr.departure_at = ? AND tr.arrival_at <=> ?)
         AND tr.status = 'SCHEDULED'
         AND tr.departure_at >= NOW()
         AND tr.departure_at <= DATE_ADD(NOW(), INTERVAL ? DAY)
         AND tr.seats_sold < tr.capacity
       ORDER BY tr.departure_at ASC
       LIMIT 200`,
      [ticket.routeId, ticket.tripId, ticket.currentDepartureAt, ticket.currentArrivalAt, days]
    )

    res.json({
      ticket: {
        uuid: ticket.uuid,
        tripId: ticket.tripId,
        routeCode: ticket.routeCode,
        origin: ticket.origin,
        destination: ticket.destination,
        departureAt: ticket.currentDepartureAt,
        arrivalAt: ticket.currentArrivalAt,
      },
      alternatives: alternatives || [],
    })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.post('/tickets/:uuid/change-trip', authenticate, async (req: any, res) => {
  const ticketUuid = String(req.params.uuid || '').trim()
  const newTripId = parsePositiveInt(req.body?.newTripId)
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: 'unauthorized' })
  if (!ticketUuid) return res.status(400).json({ error: 'uuid required' })
  if (!newTripId) return res.status(400).json({ error: 'newTripId required' })

  try {
    const result = await transaction(async (tx: any) => {
      const [ticketRows]: any = await tx.query(
        `SELECT t.id, t.uuid, t.trip_id AS tripId, t.status,
                o.user_id AS userId,
                tr.route_id AS routeId,
                tr.departure_at AS oldDepartureAt
         FROM \`Ticket\` t
         JOIN \`Order\` o ON o.id = t.order_id
         JOIN \`Trip\` tr ON tr.id = t.trip_id
         WHERE t.uuid = ?
         LIMIT 1`,
        [ticketUuid]
      )
      const ticket = ticketRows && ticketRows[0]
      if (!ticket) throw new Error('ticket not found')
      if (Number(ticket.userId) !== Number(userId)) throw new Error('forbidden')

      const ticketStatus = String(ticket.status || '').toUpperCase()
      if (ticketStatus !== 'ACTIVE') throw new Error('only active tickets can be changed')

      const [newTripRows]: any = await tx.query(
        `SELECT id, route_id AS routeId, status, capacity, seats_sold AS seatsSold,
                DATE_FORMAT(departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
                DATE_FORMAT(arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
         FROM \`Trip\`
         WHERE id = ?
         LIMIT 1`,
        [newTripId]
      )
      const newTrip = newTripRows && newTripRows[0]
      if (!newTrip) throw new Error('new trip not found')
      if (Number(newTrip.routeId) !== Number(ticket.routeId)) throw new Error('new trip must belong to the same route')
      if (String(newTrip.status || '').toUpperCase() !== 'SCHEDULED') throw new Error('new trip is not available')
      if (Number(newTrip.id) === Number(ticket.tripId)) throw new Error('ticket already belongs to this trip')
      if (Number(newTrip.seatsSold || 0) >= Number(newTrip.capacity || 0)) throw new Error('new trip has no available seats')

      await tx.query(
        'UPDATE \`Trip\` SET seats_sold = seats_sold - 1 WHERE id = ? AND seats_sold > 0',
        [Number(ticket.tripId)]
      )

      const [reserveRows]: any = await tx.query(
        'UPDATE \`Trip\` SET seats_sold = seats_sold + 1 WHERE id = ? AND seats_sold + 1 <= capacity',
        [newTripId]
      )
      const reserved = (reserveRows && (reserveRows.affectedRows ?? reserveRows.affected_rows ?? 0)) || 0
      if (reserved === 0) throw new Error('new trip has no available seats')

      const newQrToken = JSON.stringify({ ticketUuid, tripId: Number(newTrip.id) })
      await tx.query(
        'UPDATE \`Ticket\` SET trip_id = ?, qr_token = ?, verified_at = NULL, verified_by_id = NULL, verification_count = 0 WHERE id = ?',
        [Number(newTrip.id), newQrToken, Number(ticket.id)]
      )

      return {
        success: true,
        ticket: {
          uuid: ticketUuid,
          tripId: Number(newTrip.id),
          departureAt: newTrip.departureAt,
          arrivalAt: newTrip.arrivalAt,
          qrToken: newQrToken,
        },
      }
    })

    res.json(result)
  } catch (e: any) {
    const message = String(e.message || e)
    if (message === 'forbidden') return res.status(403).json({ error: message })
    if (message.includes('not found')) return res.status(404).json({ error: message })
    return res.status(400).json({ error: message })
  }
})

router.post('/tickets/:uuid/cancel', authenticate, async (req: any, res) => {
  const ticketUuid = String(req.params.uuid || '').trim()
  const userId = req.user?.userId
  if (!userId) return res.status(401).json({ error: 'unauthorized' })
  if (!ticketUuid) return res.status(400).json({ error: 'uuid required' })

  try {
    const result = await transaction(async (tx: any) => {
      const [ticketRows]: any = await tx.query(
        `SELECT t.id, t.uuid, t.trip_id AS tripId, t.order_id AS orderId, t.status,
                o.user_id AS userId
         FROM \`Ticket\` t
         JOIN \`Order\` o ON o.id = t.order_id
         WHERE t.uuid = ?
         LIMIT 1`,
        [ticketUuid]
      )
      const ticket = ticketRows && ticketRows[0]
      if (!ticket) throw new Error('ticket not found')
      if (Number(ticket.userId) !== Number(userId)) throw new Error('forbidden')

      const ticketStatus = String(ticket.status || '').toUpperCase()
      if (ticketStatus !== 'ACTIVE') throw new Error('only active tickets can be cancelled')

      const [cancelRows]: any = await tx.query(
        'UPDATE \`Ticket\` SET status = ?, qr_token = NULL WHERE id = ? AND status = ?',
        ['CANCELLED', Number(ticket.id), 'ACTIVE']
      )
      const cancelled = (cancelRows && (cancelRows.affectedRows ?? cancelRows.affected_rows ?? 0)) || 0
      if (cancelled === 0) throw new Error('ticket already updated')

      await tx.query(
        'UPDATE \`Trip\` SET seats_sold = seats_sold - 1 WHERE id = ? AND seats_sold > 0',
        [Number(ticket.tripId)]
      )

      const [remainingRows]: any = await tx.query(
        'SELECT COUNT(1) AS total FROM \`Ticket\` WHERE order_id = ? AND status = ?',
        [Number(ticket.orderId), 'ACTIVE']
      )
      const activeLeft = Number(remainingRows?.[0]?.total || 0)
      if (activeLeft === 0) {
        await tx.query('UPDATE \`Order\` SET status = ? WHERE id = ?', ['CANCELLED', Number(ticket.orderId)])
      }

      return {
        success: true,
        ticket: {
          uuid: ticketUuid,
          status: 'CANCELLED',
        },
        refundProcessed: false,
      }
    })

    res.json(result)
  } catch (e: any) {
    const message = String(e.message || e)
    if (message === 'forbidden') return res.status(403).json({ error: message })
    if (message.includes('not found')) return res.status(404).json({ error: message })
    return res.status(400).json({ error: message })
  }
})

router.get('/:id', authenticate, async (req: any, res) => {
  const id = Number(req.params.id)
  const payload = req.user
  const role = payload?.role
  const requesterId = payload?.userId
  try {
    const rows: any = await query('SELECT o.id, o.user_id AS userId, o.total_amount AS totalAmount, o.currency, o.status, o.payment_method AS paymentMethod, o.payment_reference AS paymentReference, o.created_at AS createdAt, o.updated_at AS updatedAt, t.id AS ticketId, t.uuid AS ticketUuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.seat_number AS seatNumber, t.price AS price, t.status AS ticketStatus, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, t.verification_count AS verificationCount FROM `Order` o LEFT JOIN `Ticket` t ON t.order_id = o.id WHERE o.id = ?', [id])
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'order not found' })
    const order = rows[0]
    const isOwner = order.userId === requesterId
    const isStaff = role === 'AGENCY_WORKER' || role === 'AGENCY_ADMIN' || role === 'ADMIN'
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'forbidden' })
    res.json({ order, tickets: rows })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
