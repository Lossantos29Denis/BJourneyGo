import { Router } from 'express'
import { query, transaction } from '../../../lib/db'
import { authenticate } from '../../../server/middleware'

function parsePositiveInt(value: any): number {
  const n = Number(value)
  return Number.isInteger(n) && n > 0 ? n : 0
}

export function registerOrderTicketsHandlers(router: Router) {
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
}
