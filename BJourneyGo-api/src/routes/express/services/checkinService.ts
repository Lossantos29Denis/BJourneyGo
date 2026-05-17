import { query } from '../../../lib/db'
import {
    normalizeEmail,
    normalizeIdentifier,
    normalizePhone,
    normalizeReferenceCode,
} from '../utils/inputParsers'

const CHECKIN_ORDER_SQL = `SELECT o.id, o.reference_code AS referenceCode, o.contact_email AS contactEmail, o.contact_phone AS contactPhone,
       o.total_amount AS totalAmount, o.currency, o.status, o.created_at AS createdAt
 FROM \`Order\` o
 WHERE o.reference_code = ?
   AND (
     LOWER(COALESCE(o.contact_email, '')) = ?
     OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), '(', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), '(', '')
     OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), ')', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), ')', '')
   )
 LIMIT 1`

const CHECKIN_TICKETS_SQL = `SELECT t.id, t.uuid, t.status, t.price, t.issued_at AS issuedAt, t.verified_at AS verifiedAt,
       t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification,
       t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.qr_token AS qrToken,
       tr.departure_at AS departureAt, tr.arrival_at AS arrivalAt, r.origin, r.destination, r.code AS routeCode
 FROM \`Ticket\` t
 JOIN \`Trip\` tr ON tr.id = t.trip_id
 JOIN \`Route\` r ON r.id = tr.route_id
 WHERE t.order_id = ?
 ORDER BY t.id ASC`

export async function findCheckinOrder(referenceCode: string, identifierRaw: string) {
  const safeReferenceCode = normalizeReferenceCode(referenceCode)
  const safeIdentifier = normalizeIdentifier(identifierRaw)
  const identifierEmail = normalizeEmail(safeIdentifier)
  const identifierPhone = normalizePhone(safeIdentifier)

  if (!safeReferenceCode || !safeIdentifier) {
    return null
  }

  const orderRows: any = await query(CHECKIN_ORDER_SQL, [safeReferenceCode, identifierEmail, identifierPhone, identifierPhone])
  return orderRows?.[0] || null
}

export async function findCheckinTickets(orderId: number) {
  const tickets: any = await query(CHECKIN_TICKETS_SQL, [Number(orderId)])
  return tickets || []
}

export async function updateCheckinContact(orderId: number, nextEmail: string, nextPhone: string) {
  await query(
    'UPDATE `Order` SET contact_email = COALESCE(?, contact_email), contact_phone = COALESCE(?, contact_phone), updated_at = NOW() WHERE id = ?',
    [nextEmail || null, nextPhone || null, Number(orderId)]
  )
}
