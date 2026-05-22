import { query, transaction } from '../../../lib/db'

export async function createPurchaseOrder(params: {
  userId: number
  tripId: number
  quantity: number
  paymentProvider?: string
  providerRef?: string
}) {
  const { userId, tripId, quantity, paymentProvider, providerRef } = params

  return transaction(async (tx: any) => {
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
}

export async function listUserOrders(userId: number, userEmail?: string) {
  const normalizedEmail = String(userEmail || '').trim().toLowerCase()
  const whereClauses = ['o.user_id = ?']
  const params: any[] = [Number(userId)]
  if (normalizedEmail) {
    whereClauses.push('LOWER(COALESCE(o.contact_email, \'\')) = ?')
    params.push(normalizedEmail)
  }
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
     WHERE ${whereClauses.join(' OR ')}
     ORDER BY o.created_at DESC, t.id ASC`,
    params
  )

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

  return Array.from(ordersMap.values())
}

export async function loadOrderWithTickets(orderId: number) {
  const rows: any = await query('SELECT o.id, o.user_id AS userId, o.contact_email AS contactEmail, o.total_amount AS totalAmount, o.currency, o.status, o.payment_method AS paymentMethod, o.payment_reference AS paymentReference, o.created_at AS createdAt, o.updated_at AS updatedAt, t.id AS ticketId, t.uuid AS ticketUuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.seat_number AS seatNumber, t.price AS price, t.status AS ticketStatus, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, t.verification_count AS verificationCount FROM `Order` o LEFT JOIN `Ticket` t ON t.order_id = o.id WHERE o.id = ?', [Number(orderId)])
  return rows || []
}
