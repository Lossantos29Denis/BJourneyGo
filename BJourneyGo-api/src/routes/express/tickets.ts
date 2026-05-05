import { Router } from 'express'
import { query, transaction } from '../../lib/db'
import { authenticate } from '../../server/middleware'

const router = Router()
const VERIFY_EARLY_MINUTES_RAW = Number(process.env.QR_VERIFY_EARLY_MINUTES || 60)
const VERIFY_LATE_MINUTES_RAW = Number(process.env.QR_VERIFY_LATE_MINUTES || 120)
const VERIFY_EARLY_MINUTES = Number.isFinite(VERIFY_EARLY_MINUTES_RAW) && VERIFY_EARLY_MINUTES_RAW >= 0 ? VERIFY_EARLY_MINUTES_RAW : 60
const VERIFY_LATE_MINUTES = Number.isFinite(VERIFY_LATE_MINUTES_RAW) && VERIFY_LATE_MINUTES_RAW >= 0 ? VERIFY_LATE_MINUTES_RAW : 120
const VERIFY_ENFORCE_WINDOW = String(process.env.QR_VERIFY_ENFORCE_WINDOW || 'false').toLowerCase() !== 'false'

function normalizeText(value: any) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function identifierCandidates(value: any) {
  const base = normalizeText(value)
  if (!base) return [] as string[]
  const compact = base.replace(/\s+/g, ' ').trim()
  const alphaNum = compact.replace(/[^a-z0-9]/g, '')
  const digits = compact.replace(/\D/g, '')
  const out = new Set<string>()
  out.add(compact)
  if (alphaNum) out.add(alphaNum)
  if (digits) out.add(digits)
  return Array.from(out)
}

function identifiersMatch(presentedId: any, values: any[]) {
  const presented = new Set(identifierCandidates(presentedId))
  if (presented.size === 0) return false
  for (const value of values) {
    for (const candidate of identifierCandidates(value)) {
      if (presented.has(candidate)) return true
    }
  }
  return false
}

// GET /tickets/lookup/:uuid — require authentication; owners or staff can view
router.get('/lookup/:uuid', authenticate, async (req: any, res) => {
  const uuid = req.params.uuid
  const payload = req.user
  const role = payload?.role
  const requesterId = payload?.userId
  if (!uuid) return res.status(400).json({ error: 'uuid required' })
  try {
    const rows: any = await query('SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.seat_number AS seatNumber, t.price, t.status, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, o.user_id AS purchaserUserId FROM `Ticket` t LEFT JOIN `Order` o ON o.id = t.order_id WHERE t.uuid = ? LIMIT 1', [uuid])
    const ticket = rows && rows[0]
    if (!ticket) return res.status(404).json({ error: 'not found' })
    const isOwner = ticket.purchaserUserId === requesterId
    const isStaff = role === 'AGENCY_WORKER' || role === 'AGENCY_ADMIN' || role === 'ADMIN'
    if (!isOwner && !isStaff) return res.status(403).json({ error: 'forbidden' })
    res.json({ ticket })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.post('/verify', authenticate, async (req: any, res) => {
  const { ticketUuid, tripId, presentedId } = req.body || {}
  if (!ticketUuid || !tripId) return res.status(400).json({ error: 'ticketUuid and tripId required' })
  const payload = req.user
  const verifierUserId = payload?.userId
  const role = payload?.role
  if (!(role === 'AGENCY_WORKER' || role === 'AGENCY_ADMIN' || role === 'ADMIN')) return res.status(403).json({ error: 'forbidden' })

  try {
    const result = await transaction(async (tx: any) => {
      const [ticketRows]: any = await tx.query(
        'SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.seat_number AS seatNumber, t.price, t.status, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, t.verification_count AS verificationCount, o.user_id AS purchaserUserId FROM `Ticket` t LEFT JOIN `Order` o ON o.id = t.order_id WHERE t.uuid = ? LIMIT 1',
        [ticketUuid]
      )
      const ticket = ticketRows && ticketRows[0]
      if (!ticket) throw new Error('Ticket not found')
      if (ticket.tripId !== Number(tripId)) throw new Error('Ticket does not belong to this trip')

      const [windowRows]: any = await tx.query(
        `SELECT
           NOW() AS dbNow,
           t.departure_at AS departureAtDb,
           DATE_SUB(t.departure_at, INTERVAL ? MINUTE) AS earliest,
           DATE_ADD(t.departure_at, INTERVAL ? MINUTE) AS latest,
           CASE
             WHEN NOW() BETWEEN DATE_SUB(t.departure_at, INTERVAL ? MINUTE) AND DATE_ADD(t.departure_at, INTERVAL ? MINUTE)
             THEN 1 ELSE 0
           END AS insideWindow
         FROM \`Trip\` t
         WHERE t.id = ?
         LIMIT 1`,
        [VERIFY_EARLY_MINUTES, VERIFY_LATE_MINUTES, VERIFY_EARLY_MINUTES, VERIFY_LATE_MINUTES, ticket.tripId]
      )
      const w = windowRows && windowRows[0]
      const insideWindow = Number(w?.insideWindow || 0) === 1
      if (VERIFY_ENFORCE_WINDOW && !insideWindow) {
        throw new Error(`Ticket verification outside allowed time window (${VERIFY_EARLY_MINUTES}m before to ${VERIFY_LATE_MINUTES}m after departure)`)
      }

      const [userRows]: any = await tx.query('SELECT name, phone, email FROM `User` WHERE id = ? LIMIT 1', [ticket.purchaserUserId])
      const purchaser = userRows && userRows[0]
      const presented = String(presentedId || '').trim()
      const [orderTicketRows]: any = await tx.query(
        'SELECT uuid, passenger_name AS passengerName, passenger_identification AS passengerIdentification, passenger_phone AS passengerPhone, is_contact AS isContact FROM `Ticket` WHERE order_id = ? ORDER BY id ASC',
        [ticket.orderId]
      )
      const orderPassengers = (orderTicketRows || []).map((r: any) => ({
        uuid: r.uuid,
        fullName: r.passengerName || null,
        identification: r.passengerIdentification || null,
        phone: r.passengerPhone || null,
        isContact: Boolean(r.isContact)
      }))
      const passengerIdentifiers = orderPassengers.flatMap((p: any) => [p.fullName, p.identification, p.phone]).filter(Boolean)
      const purchaserIdentifiers = [purchaser?.name, purchaser?.phone, purchaser?.email].filter(Boolean)
      if (presented) {
        const matches = identifiersMatch(presented, [...passengerIdentifiers, ...purchaserIdentifiers])
        if (!matches) throw new Error('Presented identifier does not match purchaser records')
      }

      const [updateRes]: any = await tx.query('UPDATE `Ticket` SET status = ?, verified_at = NOW(), verified_by_id = ?, verification_count = verification_count + 1 WHERE uuid = ? AND status = ?', ['USED', Number(verifierUserId), ticketUuid, 'ACTIVE'])
      const updated = (updateRes && (updateRes.affectedRows ?? 0)) || 0
      if (updated === 0) throw new Error('Ticket already used or not active')

      await tx.query('INSERT INTO `VerificationLog` (ticket_id, checked_by_user_id, agency_worker_id, result, device_info, location) VALUES (?, ?, ?, ?, ?, ?)', [ticket.id, verifierUserId, null, 'OK', null, null])

      return {
        ok: true,
        ticket: {
          uuid: ticket.uuid,
          passengerName: ticket.passengerName || null,
          passengerIdentification: ticket.passengerIdentification || null
        },
        passengers: orderPassengers
      }
    })
    res.json(result)
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

export default router
