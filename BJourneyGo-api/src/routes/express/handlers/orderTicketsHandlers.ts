import { Router } from 'express'
import { query, transaction } from '../../../lib/db'
import { sendMail } from '../../../lib/mailer'
import { authenticate } from '../../../server/middleware'
import { applyTicketTripChange, loadTicketChangeQuote } from '../utils/ticketChange'

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
        `SELECT t.id, t.uuid, t.trip_id AS tripId, t.price AS currentPrice, t.status,
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

      const daysRaw = req.query?.days === undefined ? undefined : Number(req.query?.days)
      const hasLimit = typeof daysRaw === 'number' && Number.isFinite(daysRaw) && daysRaw > 0
      const days = hasLimit ? Math.min(365, Math.max(1, Math.floor(daysRaw))) : 0

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
           AND tr.seats_sold < tr.capacity
         ORDER BY tr.departure_at ASC
         LIMIT 200`,
        hasLimit ? [ticket.routeId, ticket.tripId, ticket.currentDepartureAt, ticket.currentArrivalAt, days] : [ticket.routeId, ticket.tripId, ticket.currentDepartureAt, ticket.currentArrivalAt]
      )

      res.json({
        ticket: {
          uuid: ticket.uuid,
          tripId: ticket.tripId,
          routeCode: ticket.routeCode,
          currentPrice: Number(ticket.currentPrice || 0),
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
        const quote = await loadTicketChangeQuote(tx, { ticketUuid, newTripId, userId })

        if (quote.deltaAmount > 0) {
          return {
            success: false,
            requiresPayment: true,
            deltaAmount: quote.deltaAmount,
            currency: quote.ticket.currency || 'EUR',
            currentTrip: {
              tripId: Number(quote.ticket.tripId),
              routeCode: quote.ticket.routeCode,
              origin: quote.ticket.origin,
              destination: quote.ticket.destination,
              departureAt: quote.ticket.departureAt || null,
            },
            newTrip: {
              tripId: Number(quote.newTrip.id),
              routeCode: quote.newTrip.routeCode,
              origin: quote.newTrip.origin,
              destination: quote.newTrip.destination,
              departureAt: quote.newTrip.departureAt,
              arrivalAt: quote.newTrip.arrivalAt,
              basePrice: Number(quote.newTrip.basePrice || 0),
            },
          }
        }

        const changeResult = await applyTicketTripChange(tx, {
          ticketId: Number(quote.ticket.id),
          ticketUuid: String(quote.ticket.uuid || ticketUuid),
          orderId: Number(quote.ticket.orderId),
          oldTripId: Number(quote.ticket.tripId),
          newTripId: Number(quote.newTrip.id),
          newTripPrice: Number(quote.newTrip.basePrice || 0),
        })

        return {
          success: true,
          ticket: {
            uuid: ticketUuid,
            tripId: Number(quote.newTrip.id),
            departureAt: quote.newTrip.departureAt,
            arrivalAt: quote.newTrip.arrivalAt,
            qrToken: changeResult.qrToken,
            price: Number(quote.newTrip.basePrice || 0),
          },
        }
      })

      if (result.requiresPayment) {
        return res.status(409).json(result)
      }

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

  router.post('/tickets/:uuid/refund-request', authenticate, async (req: any, res) => {
    const ticketUuid = String(req.params.uuid || '').trim()
    const userId = req.user?.userId
    const reason = String(req.body?.reason || '').trim()
    const notes = String(req.body?.notes || '').trim()

    if (!userId) return res.status(401).json({ error: 'unauthorized' })
    if (!ticketUuid) return res.status(400).json({ error: 'uuid required' })
    if (!reason) return res.status(400).json({ error: 'reason required' })

    try {
      const [rows]: any = await query(
        `SELECT t.id, t.uuid, t.status, t.price, t.passenger_name AS passengerName,
                o.id AS orderId, o.reference_code AS referenceCode, o.contact_email AS contactEmail, o.contact_phone AS contactPhone,
                u.name AS userName, u.email AS userEmail,
                tr.departure_at AS departureAt, tr.arrival_at AS arrivalAt,
                r.origin, r.destination, r.code AS routeCode,
                a.name AS agencyName, a.contact_email AS agencyEmail
         FROM \`Ticket\` t
         JOIN \`Order\` o ON o.id = t.order_id
         JOIN \`User\` u ON u.id = o.user_id
         JOIN \`Trip\` tr ON tr.id = t.trip_id
         JOIN \`Route\` r ON r.id = tr.route_id
         LEFT JOIN \`Agency\` a ON a.id = r.agency_id
         WHERE t.uuid = ? AND o.user_id = ?
         LIMIT 1`,
        [ticketUuid, userId]
      )

      const ticket = rows && rows[0]
      if (!ticket) return res.status(404).json({ error: 'ticket not found' })

      const messageTitle = `Solicitud de reembolso asistido - ${ticket.referenceCode || ticket.uuid}`
      const messageText = [
        `Ticket: ${ticket.uuid}`,
        `Referencia: ${ticket.referenceCode || '—'}`,
        `Cliente: ${ticket.userName || '—'} (${ticket.userEmail || '—'})`,
        `Ruta: ${ticket.origin || '—'} -> ${ticket.destination || '—'}`,
        `Salida: ${ticket.departureAt || '—'}`,
        `Llegada: ${ticket.arrivalAt || '—'}`,
        `Agencia: ${ticket.agencyName || '—'}`,
        `Motivo: ${reason}`,
        notes ? `Notas: ${notes}` : null,
        '',
        'El cliente solicita revisión supervisada por la agencia y el equipo técnico para completar el reembolso si procede.'
      ].filter(Boolean).join('\n')

      const emailTargets = Array.from(new Set([
        process.env.SUPPORT_EMAIL || process.env.CONTACT_EMAIL || 'support@bjourneygo.me',
        String(ticket.agencyEmail || '').trim(),
      ].filter(Boolean)))

      await sendMail({
        to: emailTargets,
        subject: `[Web] ${messageTitle}`,
        text: messageText,
        html: messageText.replace(/\n/g, '<br/>'),
      })

      return res.json({
        success: true,
        recipients: emailTargets,
        request: {
          ticketUuid,
          reason,
        },
      })
    } catch (e: any) {
      return res.status(500).json({ error: String(e.message || e) })
    }
  })
}
