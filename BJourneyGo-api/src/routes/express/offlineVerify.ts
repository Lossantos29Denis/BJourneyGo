import { Router } from 'express'
import { transaction } from '../../lib/db'
import { authenticate } from '../../server/middleware'

const router = Router()

router.post('/verify-offline', authenticate, async (req: any, res) => {
  const { records } = req.body || {}
  if (!Array.isArray(records) || records.length === 0) return res.status(400).json({ error: 'records array required' })
  const verifierUserId = req.user?.userId
  const results: any[] = []
  try {
    for (const r of records) {
      const { ticketUuid, presentedId, checkedAt, deviceInfo, location, result } = r
      try {
        await transaction(async (tx: any) => {
          const [ticketRows]: any = await tx.query(
            'SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.seat_number AS seatNumber, t.price, t.status, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, t.verification_count AS verificationCount, o.user_id AS purchaserUserId FROM `Ticket` t LEFT JOIN `Order` o ON o.id = t.order_id WHERE t.uuid = ? LIMIT 1',
            [ticketUuid]
          )
          const ticket = ticketRows && ticketRows[0]
          if (!ticket) throw new Error('Ticket not found')

          const matches = presentedId
            ? [ticket.passengerName, ticket.passengerIdentification, ticket.passengerPhone]
                .filter(Boolean)
                .map(String)
                .map(s => s.toLowerCase())
                .includes(String(presentedId).toLowerCase())
            : true

          let appliedResult = result && String(result).toUpperCase() === 'OK' && matches ? 'OK' : 'INVALID'

          if (appliedResult === 'OK') {
            const [updateRes]: any = await tx.query('UPDATE `Ticket` SET status = ?, verified_at = ?, verified_by_id = ?, verification_count = verification_count + 1 WHERE uuid = ? AND status = ?', ['USED', checkedAt ? new Date(checkedAt) : new Date(), Number(verifierUserId), ticketUuid, 'ACTIVE'])
            const updated = (updateRes && (updateRes.affectedRows ?? 0)) || 0
            if (updated === 0) appliedResult = 'ALREADY_USED'
          }

          await tx.query('INSERT INTO `VerificationLog` (ticket_id, checked_by_user_id, agency_worker_id, result, checked_at, device_info, location) VALUES (?, ?, ?, ?, ?, ?, ?)', [ticket.id, verifierUserId, null, appliedResult, checkedAt ? new Date(checkedAt) : null, deviceInfo || null, location || null])
          results.push({ ticketUuid, result: appliedResult })
        })
      } catch (err: any) {
        results.push({ ticketUuid: r.ticketUuid, error: String(err.message || err) })
      }
    }
    res.json({ results })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
