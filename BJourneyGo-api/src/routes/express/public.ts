import { Router } from 'express'
import { query } from '../../lib/db'
import { sendMail } from '../../lib/mailer'

const router = Router()

// GET /trips?q=&origin=&destination=&startDate=&endDate=
router.get('/trips', async (req, res) => {
  try {
    const { q, origin, destination, startDate, endDate } = req.query as any
    const queryText = String(q || '').trim()
    const originText = String(origin || '').trim()
    const destinationText = String(destination || '').trim()
    const start = String(startDate || '').trim()
    const end = String(endDate || '').trim()

    if (!queryText && (!originText || !destinationText) && !start && !end) {
      return res.status(400).json({ error: 'q or origin/destination with optional date range are required' })
    }
    if ((start && !end) || (!start && end)) {
      return res.status(400).json({ error: 'startDate and endDate must be provided together' })
    }
    if (start || end) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
        return res.status(400).json({ error: 'invalid date format, expected YYYY-MM-DD' })
      }
      if (end < start) {
        return res.status(400).json({ error: 'endDate must be greater than or equal to startDate' })
      }
    }

    const clauses: string[] = ["t.status = 'SCHEDULED'"]
    const params: any[] = []

    if (queryText) {
      const qLike = `%${queryText.toLowerCase()}%`
      clauses.push('(LOWER(r.code) LIKE ? OR LOWER(r.origin) LIKE ? OR LOWER(r.destination) LIKE ?)')
      params.push(qLike, qLike, qLike)
    } else {
      clauses.push('LOWER(r.origin) LIKE ?')
      params.push(`%${originText.toLowerCase()}%`)
      clauses.push('LOWER(r.destination) LIKE ?')
      params.push(`%${destinationText.toLowerCase()}%`)
    }

    if (start && end) {
      // Date range is inclusive for full calendar days.
      clauses.push('t.departure_at >= ?')
      params.push(`${start} 00:00:00`)
      clauses.push('t.departure_at < DATE_ADD(?, INTERVAL 1 DAY)')
      params.push(`${end} 00:00:00`)
    }

    const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
    const sql = `SELECT t.id, t.route_id AS routeId, r.code AS routeCode, r.origin, r.destination, DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id ${where} ORDER BY t.departure_at ASC LIMIT 200`
    const rows: any = await query(sql, params)
    res.json({ trips: rows })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.get('/trips/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const rows: any = await query('SELECT t.id, t.route_id AS routeId, r.code AS routeCode, r.origin, r.destination, t.bus_id AS busId, DATE_FORMAT(t.departure_at, \'%Y-%m-%d %H:%i:%s\') AS departureAt, DATE_FORMAT(t.arrival_at, \'%Y-%m-%d %H:%i:%s\') AS arrivalAt, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice FROM `Trip` t JOIN `Route` r ON r.id = t.route_id WHERE t.id = ? LIMIT 1', [id])
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'not found' })
    res.json({ trip: rows[0] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.get('/routes', async (req, res) => {
  try {
    const rows: any = await query('SELECT id, code, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status FROM `Route` WHERE status = ? ORDER BY origin, destination', ['ACTIVE'])
    res.json({ routes: rows })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.get('/buses', async (req, res) => {
  try {
    const rows: any = await query('SELECT id, plate, agency_id AS agencyId, capacity FROM `Bus` ORDER BY id')
    res.json({ buses: rows })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.get('/documents', async (_req, res) => {
  try {
    const rows: any = await query(
      'SELECT id, agency_id AS agencyId, title, category, description, file_url AS fileUrl, file_size AS fileSize, created_at AS createdAt, updated_at AS updatedAt FROM `Document` ORDER BY updated_at DESC'
    )
    res.json({ documents: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.post('/checkin/lookup', async (req, res) => {
  try {
    const referenceCode = String((req.body as any)?.referenceCode || '').trim().toUpperCase()
    const identifierRaw = String((req.body as any)?.identifier || '').trim()
    const identifierEmail = identifierRaw.toLowerCase()
    const identifierPhone = identifierRaw.replace(/[^\d+]/g, '')

    if (!referenceCode || !identifierRaw) {
      return res.status(400).json({ error: 'referenceCode and identifier are required' })
    }

    const orderRows: any = await query(
      `SELECT o.id, o.reference_code AS referenceCode, o.contact_email AS contactEmail, o.contact_phone AS contactPhone,
              o.total_amount AS totalAmount, o.currency, o.status, o.created_at AS createdAt
       FROM \`Order\` o
       WHERE o.reference_code = ?
         AND (
           LOWER(COALESCE(o.contact_email, '')) = ?
           OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), '(', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), '(', '')
           OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), ')', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), ')', '')
         )
       LIMIT 1`,
      [referenceCode, identifierEmail, identifierPhone, identifierPhone]
    )

    const order = orderRows?.[0]
    if (!order) return res.status(404).json({ error: 'Reserva no encontrada' })

    const tickets: any = await query(
      `SELECT t.id, t.uuid, t.status, t.price, t.issued_at AS issuedAt, t.verified_at AS verifiedAt,
              t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification,
              t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.qr_token AS qrToken,
              tr.departure_at AS departureAt, tr.arrival_at AS arrivalAt, r.origin, r.destination, r.code AS routeCode
       FROM \`Ticket\` t
       JOIN \`Trip\` tr ON tr.id = t.trip_id
       JOIN \`Route\` r ON r.id = tr.route_id
       WHERE t.order_id = ?
       ORDER BY t.id ASC`,
      [order.id]
    )

    res.json({ order, tickets: tickets || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.post('/checkin/update-contact', async (req, res) => {
  try {
    const referenceCode = String((req.body as any)?.referenceCode || '').trim().toUpperCase()
    const identifierRaw = String((req.body as any)?.identifier || '').trim()
    const nextEmail = String((req.body as any)?.contactEmail || '').trim().toLowerCase()
    const nextPhone = String((req.body as any)?.contactPhone || '').trim()
    if (!referenceCode || !identifierRaw) {
      return res.status(400).json({ error: 'referenceCode and identifier are required' })
    }
    if (!nextEmail && !nextPhone) {
      return res.status(400).json({ error: 'contactEmail or contactPhone is required' })
    }
    if (nextEmail && !/^\S+@\S+\.\S+$/.test(nextEmail)) {
      return res.status(400).json({ error: 'contactEmail is invalid' })
    }

    const identifierEmail = identifierRaw.toLowerCase()
    const identifierPhone = identifierRaw.replace(/[^\d+]/g, '')

    const orderRows: any = await query(
      `SELECT o.id, o.reference_code AS referenceCode, o.contact_email AS contactEmail, o.contact_phone AS contactPhone,
              o.total_amount AS totalAmount, o.currency, o.status, o.created_at AS createdAt
       FROM \`Order\` o
       WHERE o.reference_code = ?
         AND (
           LOWER(COALESCE(o.contact_email, '')) = ?
           OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), '(', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), '(', '')
           OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), ')', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), ')', '')
         )
       LIMIT 1`,
      [referenceCode, identifierEmail, identifierPhone, identifierPhone]
    )

    const order = orderRows?.[0]
    if (!order) return res.status(404).json({ error: 'Reserva no encontrada' })

    const tickets: any = await query(
      `SELECT t.id, t.uuid, t.status, t.price, t.issued_at AS issuedAt, t.verified_at AS verifiedAt,
              t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification,
              t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.qr_token AS qrToken,
              tr.departure_at AS departureAt, tr.arrival_at AS arrivalAt, r.origin, r.destination, r.code AS routeCode
       FROM \`Ticket\` t
       JOIN \`Trip\` tr ON tr.id = t.trip_id
       JOIN \`Route\` r ON r.id = tr.route_id
       WHERE t.order_id = ?
       ORDER BY t.id ASC`,
      [order.id]
    )

    res.json({ order, tickets: tickets || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

router.post('/checkin/update-contact', async (req, res) => {
  try {
    const referenceCode = String((req.body as any)?.referenceCode || '').trim().toUpperCase()
    const identifierRaw = String((req.body as any)?.identifier || '').trim()
    const nextEmail = String((req.body as any)?.contactEmail || '').trim().toLowerCase()
    const nextPhone = String((req.body as any)?.contactPhone || '').trim()
    if (!referenceCode || !identifierRaw) {
      return res.status(400).json({ error: 'referenceCode and identifier are required' })
    }
    if (!nextEmail && !nextPhone) {
      return res.status(400).json({ error: 'contactEmail or contactPhone is required' })
    }
    if (nextEmail && !/^\S+@\S+\.\S+$/.test(nextEmail)) {
      return res.status(400).json({ error: 'contactEmail is invalid' })
    }

    const identifierEmail = identifierRaw.toLowerCase()
    const identifierPhone = identifierRaw.replace(/[^\d+]/g, '')

    const orderRows: any = await query(
      `SELECT o.id
       FROM \`Order\` o
       WHERE o.reference_code = ?
         AND (
           LOWER(COALESCE(o.contact_email, '')) = ?
           OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), '(', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), '(', '')
           OR REPLACE(REPLACE(REPLACE(COALESCE(o.contact_phone, ''), ' ', ''), '-', ''), ')', '') = REPLACE(REPLACE(REPLACE(?, ' ', ''), '-', ''), ')', '')
         )
       LIMIT 1`,
      [referenceCode, identifierEmail, identifierPhone, identifierPhone]
    )

    const order = orderRows?.[0]
    if (!order) return res.status(404).json({ error: 'Reserva no encontrada' })

    await query(
      'UPDATE `Order` SET contact_email = COALESCE(?, contact_email), contact_phone = COALESCE(?, contact_phone), updated_at = NOW() WHERE id = ?',
      [nextEmail || null, nextPhone || null, order.id]
    )

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /contact — landing page contact form
router.post('/contact', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {}
    if (!name || !email || !message) {
      return res.status(400).json({ error: 'name, email and message are required' })
    }
    // Basic email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
      return res.status(400).json({ error: 'invalid email' })
    }
    const CONTACT_TO = process.env.CONTACT_EMAIL || 'bjourneygo@gmail.com'
    const safeSubject = String(subject || 'Consulta desde la web').slice(0, 200)
    const safeName = String(name).slice(0, 100)
    const safeMessage = String(message).slice(0, 5000)
    const safeEmail = String(email).slice(0, 200)
    await sendMail({
      to: CONTACT_TO,
      subject: `[Web] ${safeSubject}`,
      text: `Nombre: ${safeName}\nEmail: ${safeEmail}\nAsunto: ${safeSubject}\n\n${safeMessage}`,
      html: `<p><strong>Nombre:</strong> ${safeName}</p><p><strong>Email:</strong> ${safeEmail}</p><p><strong>Asunto:</strong> ${safeSubject}</p><hr/><p>${safeMessage.replace(/\n/g, '<br/>')}</p>`
    })
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
