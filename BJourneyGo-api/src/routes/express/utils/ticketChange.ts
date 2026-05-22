export type TicketChangeQuote = {
  ticket: any
  newTrip: any
  currentPrice: number
  newPrice: number
  deltaAmount: number
}

type TxLike = {
  query: (sql: string, params?: any[]) => Promise<any>
}

function toNumber(value: any): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

export async function loadTicketChangeQuote(tx: TxLike, params: { ticketUuid: string; newTripId: number; orderId?: number | null; userId?: number | null; requesterEmail?: string | null }): Promise<TicketChangeQuote> {
  const { ticketUuid, newTripId, orderId, userId, requesterEmail } = params
  const ticketConditions: string[] = ['t.uuid = ?']
  const ticketParams: any[] = [ticketUuid]
  if (orderId) {
    ticketConditions.push('t.order_id = ?')
    ticketParams.push(orderId)
  }

  const [ticketRows]: any = await tx.query(
      `SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.price AS currentPrice, t.status,
        o.user_id AS userId, o.contact_email AS contactEmail, o.currency AS currency,
            tr.route_id AS routeId,
            r.origin, r.destination, r.code AS routeCode
     FROM \`Ticket\` t
     JOIN \`Order\` o ON o.id = t.order_id
     JOIN \`Trip\` tr ON tr.id = t.trip_id
     JOIN \`Route\` r ON r.id = tr.route_id
     WHERE ${ticketConditions.join(' AND ')}
     LIMIT 1`,
    ticketParams
  )
  const ticket = ticketRows && ticketRows[0]
  if (!ticket) throw new Error('ticket not found')
  const normalizedEmail = String(requesterEmail || '').trim().toLowerCase()
  const contactEmail = String(ticket.contactEmail || '').trim().toLowerCase()
  if (userId !== undefined && userId !== null && Number(ticket.userId) !== Number(userId)) {
    if (!normalizedEmail || normalizedEmail !== contactEmail) throw new Error('forbidden')
  }

  const ticketStatus = String(ticket.status || '').toUpperCase()
  if (ticketStatus !== 'ACTIVE') throw new Error('only active tickets can be modified')

  const [tripRows]: any = await tx.query(
    `SELECT t.id, t.route_id AS routeId, t.status, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice,
            DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
            DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
            r.origin, r.destination, r.code AS routeCode, r.agency_id AS agencyId,
            a.stripe_account_id AS agencyStripeAccountId, a.commission_percent AS commissionPercent, a.payout_active AS payoutActive
     FROM \`Trip\` t
     JOIN \`Route\` r ON r.id = t.route_id
     LEFT JOIN \`Agency\` a ON a.id = r.agency_id
     WHERE t.id = ?
     LIMIT 1`,
    [newTripId]
  )
  const newTrip = tripRows && tripRows[0]
  if (!newTrip) throw new Error('new trip not found')
  if (Number(newTrip.routeId) !== Number(ticket.routeId)) throw new Error('new trip must belong to the same route')
  if (String(newTrip.status || '').toUpperCase() !== 'SCHEDULED') throw new Error('new trip is not available')

  const currentPrice = toNumber(ticket.currentPrice)
  const newPrice = toNumber(newTrip.basePrice)
  const deltaAmount = Math.round((newPrice - currentPrice) * 100) / 100

  return {
    ticket,
    newTrip,
    currentPrice,
    newPrice,
    deltaAmount,
  }
}

export async function applyTicketTripChange(tx: TxLike, params: { ticketId: number; ticketUuid: string; orderId: number; oldTripId: number; newTripId: number; newTripPrice: number; updateOrderTotal?: boolean; orderTotalDelta?: number }) {
  const { ticketId, ticketUuid, orderId, oldTripId, newTripId, newTripPrice, updateOrderTotal = false, orderTotalDelta = 0 } = params

  const [decrementRows]: any = await tx.query(
    'UPDATE `Trip` SET seats_sold = seats_sold - 1 WHERE id = ? AND seats_sold > 0',
    [oldTripId]
  )
  const decremented = (decrementRows && (decrementRows.affectedRows ?? decrementRows.affected_rows ?? 0)) || 0
  if (decremented === 0) throw new Error('unable to release seat from current trip')

  const [incrementRows]: any = await tx.query(
    'UPDATE `Trip` SET seats_sold = seats_sold + 1 WHERE id = ? AND seats_sold + 1 <= capacity',
    [newTripId]
  )
  const incremented = (incrementRows && (incrementRows.affectedRows ?? incrementRows.affected_rows ?? 0)) || 0
  if (incremented === 0) throw new Error('new trip has no available seats')

  const newQrToken = JSON.stringify({ ticketUuid, tripId: newTripId })
  await tx.query(
    'UPDATE `Ticket` SET trip_id = ?, price = ?, qr_token = ?, verified_at = NULL, verified_by_id = NULL, verification_count = 0 WHERE id = ?',
    [newTripId, newTripPrice, newQrToken, ticketId]
  )

  if (updateOrderTotal && orderTotalDelta !== 0) {
    await tx.query('UPDATE `Order` SET total_amount = total_amount + ?, updated_at = NOW() WHERE id = ?', [orderTotalDelta, orderId])
  }

  return { success: true, qrToken: newQrToken }
}