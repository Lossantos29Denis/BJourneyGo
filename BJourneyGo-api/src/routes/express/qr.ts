import { Router } from 'express'
import { query, transaction } from '../../lib/db'
import { authenticate } from '../../server/middleware'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'
const VERIFY_EARLY_MINUTES_RAW = Number(process.env.QR_VERIFY_EARLY_MINUTES || 60)
const VERIFY_LATE_MINUTES_RAW = Number(process.env.QR_VERIFY_LATE_MINUTES || 120)
const VERIFY_EARLY_MINUTES = Number.isFinite(VERIFY_EARLY_MINUTES_RAW) && VERIFY_EARLY_MINUTES_RAW >= 0 ? VERIFY_EARLY_MINUTES_RAW : 60
const VERIFY_LATE_MINUTES = Number.isFinite(VERIFY_LATE_MINUTES_RAW) && VERIFY_LATE_MINUTES_RAW >= 0 ? VERIFY_LATE_MINUTES_RAW : 120
const VERIFY_ENFORCE_WINDOW = String(process.env.QR_VERIFY_ENFORCE_WINDOW || 'false').toLowerCase() !== 'false'

const router = Router()

function buildScannerCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}

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

async function getVerifierContext(payload: any) {
  const verifierUserId = Number(payload?.userId || 0)
  const role = String(payload?.role || '')

  let canVerify = role === 'AGENCY_WORKER' || role === 'AGENCY_ADMIN' || role === 'ADMIN'
  let agencyWorkerId: number | null = null
  let agencyId: number | null = null

  const awRows: any = await query(
    'SELECT id, agency_id AS agencyId, scanner_enabled AS scannerEnabled, active FROM `AgencyWorker` WHERE user_id = ? LIMIT 1',
    [verifierUserId]
  )
  const aw = awRows && awRows[0]
  if (aw && Number(aw.active) === 1) {
    agencyWorkerId = Number(aw.id)
    agencyId = Number(aw.agencyId)
  }

  if (!canVerify && role === 'USER' && agencyWorkerId && Number(aw?.scannerEnabled || 0) === 1) {
    canVerify = true
  }

  if (Number(aw?.scannerEnabled || 0) === 1) {
    canVerify = true
  }

  return { verifierUserId, role, canVerify, agencyWorkerId, agencyId }
}

function canManageOperatorSessions(role: string) {
  return role === 'ADMIN' || role === 'AGENCY_ADMIN'
}

async function getOperatorAllowedTripIds(operatorUserId: number) {
  const rows: any = await query(
    'SELECT trip_id AS tripId FROM `ScannerOperatorTripAccess` WHERE operator_user_id = ? AND active = 1',
    [operatorUserId]
  )
  return (rows || []).map((r: any) => Number(r.tripId)).filter((n: number) => Number.isFinite(n) && n > 0)
}

async function ensureOperatorTripAccess(userId: number, tripId: number) {
  const rows: any = await query(
    'SELECT id FROM `ScannerOperatorTripAccess` WHERE operator_user_id = ? AND trip_id = ? AND active = 1 LIMIT 1',
    [userId, tripId]
  )
  return Boolean(rows && rows[0])
}

router.get('/scanner/operators', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const role = String(payload?.role || '')
    if (!canManageOperatorSessions(role)) return res.status(403).json({ error: 'forbidden' })

    const ctx = await getVerifierContext(payload)
    const where: string[] = ['aw.active = 1', 'aw.scanner_enabled = 1']
    const params: any[] = []

    if (role !== 'ADMIN') {
      if (!ctx.agencyId) return res.status(403).json({ error: 'agency not assigned' })
      where.push('aw.agency_id = ?')
      params.push(ctx.agencyId)
    }

    const rows: any = await query(
      `SELECT u.id AS userId, u.email, u.name, aw.id AS agencyWorkerId, aw.agency_id AS agencyId, a.name AS agencyName
       FROM \`AgencyWorker\` aw
       JOIN \`User\` u ON u.id = aw.user_id
       LEFT JOIN \`Agency\` a ON a.id = aw.agency_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.name ASC, u.name ASC, u.email ASC`,
      params
    )

    res.json({ operators: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.get('/scanner/operators/:operatorUserId/access', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const role = String(payload?.role || '')
    if (!canManageOperatorSessions(role)) return res.status(403).json({ error: 'forbidden' })

    const operatorUserId = Number(req.params.operatorUserId)
    if (!operatorUserId) return res.status(400).json({ error: 'invalid operatorUserId' })

    const ctx = await getVerifierContext(payload)
    const opRows: any = await query(
      'SELECT user_id AS userId, agency_id AS agencyId, scanner_enabled AS scannerEnabled, active FROM `AgencyWorker` WHERE user_id = ? LIMIT 1',
      [operatorUserId]
    )
    const operator = opRows && opRows[0]
    if (!operator) return res.status(404).json({ error: 'operator not found' })
    if (Number(operator.active) !== 1 || Number(operator.scannerEnabled || 0) !== 1) {
      return res.status(400).json({ error: 'operator has no scanner permission' })
    }

    if (role !== 'ADMIN') {
      if (!ctx.agencyId || Number(ctx.agencyId) !== Number(operator.agencyId)) {
        return res.status(403).json({ error: 'operator does not belong to your agency' })
      }
    }

    const rows: any = await query(
      `SELECT a.trip_id AS tripId,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt,
              DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt,
              r.origin,
              r.destination,
              r.code AS routeCode,
              r.agency_id AS agencyId,
              ag.name AS agencyName
       FROM \`ScannerOperatorTripAccess\` a
       JOIN \`Trip\` t ON t.id = a.trip_id
       JOIN \`Route\` r ON r.id = t.route_id
       LEFT JOIN \`Agency\` ag ON ag.id = r.agency_id
       WHERE a.operator_user_id = ? AND a.active = 1
       ORDER BY t.departure_at DESC`,
      [operatorUserId]
    )

    res.json({ access: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.put('/scanner/operators/:operatorUserId/access', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const role = String(payload?.role || '')
    if (!canManageOperatorSessions(role)) return res.status(403).json({ error: 'forbidden' })

    const operatorUserId = Number(req.params.operatorUserId)
    const tripIdsRaw = Array.isArray(req.body?.tripIds) ? req.body.tripIds : []
    if (!operatorUserId) return res.status(400).json({ error: 'invalid operatorUserId' })

    const tripIds = Array.from(new Set(tripIdsRaw.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v) && v > 0)))
    const ctx = await getVerifierContext(payload)

    const opRows: any = await query(
      'SELECT user_id AS userId, agency_id AS agencyId, scanner_enabled AS scannerEnabled, active FROM `AgencyWorker` WHERE user_id = ? LIMIT 1',
      [operatorUserId]
    )
    const operator = opRows && opRows[0]
    if (!operator) return res.status(404).json({ error: 'operator not found' })
    if (Number(operator.active) !== 1 || Number(operator.scannerEnabled || 0) !== 1) {
      return res.status(400).json({ error: 'operator has no scanner permission' })
    }

    if (role !== 'ADMIN') {
      if (!ctx.agencyId || Number(ctx.agencyId) !== Number(operator.agencyId)) {
        return res.status(403).json({ error: 'operator does not belong to your agency' })
      }
    }

    if (tripIds.length > 0) {
      const placeholders = tripIds.map(() => '?').join(',')
      const trips: any = await query(
        `SELECT t.id, r.agency_id AS agencyId
         FROM \`Trip\` t
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE t.id IN (${placeholders})`,
        tripIds
      )
      if (!trips || trips.length !== tripIds.length) {
        return res.status(400).json({ error: 'one or more trips are invalid' })
      }
      const invalidAgency = (trips || []).find((t: any) => Number(t.agencyId) !== Number(operator.agencyId))
      if (invalidAgency) return res.status(400).json({ error: 'all trips must belong to operator agency' })

      if (role !== 'ADMIN') {
        const outside = (trips || []).find((t: any) => Number(t.agencyId) !== Number(ctx.agencyId))
        if (outside) return res.status(403).json({ error: 'trip does not belong to your agency' })
      }
    }

    await transaction(async (tx: any) => {
      await tx.query('DELETE FROM `ScannerOperatorTripAccess` WHERE operator_user_id = ?', [operatorUserId])
      for (const tripId of tripIds) {
        await tx.query(
          'INSERT INTO `ScannerOperatorTripAccess` (operator_user_id, trip_id, agency_id, active, created_by_user_id, created_at, updated_at) VALUES (?, ?, ?, 1, ?, NOW(), NOW())',
          [operatorUserId, tripId, operator.agencyId, Number(payload?.userId || 0) || null]
        )
      }
    })

    res.json({ success: true, operatorUserId, tripIds })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.post('/scanner/admin/start-session', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const role = String(payload?.role || '')
    if (!canManageOperatorSessions(role)) return res.status(403).json({ error: 'forbidden' })

    const ctx = await getVerifierContext(payload)
    const operatorUserId = Number(req.body?.operatorUserId)
    const tripId = Number(req.body?.tripId)
    const requestedCode = String(req.body?.accessCode || '').trim().toUpperCase()
    if (!operatorUserId || !tripId) return res.status(400).json({ error: 'operatorUserId and tripId required' })

    const opRows: any = await query(
      `SELECT aw.id, aw.user_id AS userId, aw.agency_id AS agencyId, aw.active, aw.scanner_enabled AS scannerEnabled,
              u.email, u.name
       FROM \`AgencyWorker\` aw
       JOIN \`User\` u ON u.id = aw.user_id
       WHERE aw.user_id = ?
       LIMIT 1`,
      [operatorUserId]
    )
    const operator = opRows && opRows[0]
    if (!operator) return res.status(404).json({ error: 'operator not found' })
    if (Number(operator.active) !== 1) return res.status(400).json({ error: 'operator inactive' })
    if (Number(operator.scannerEnabled || 0) !== 1) return res.status(400).json({ error: 'operator has no scanner permission' })

    const tripRows: any = await query(
      `SELECT t.id, r.agency_id AS agencyId, r.origin, r.destination, r.code AS routeCode,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
       FROM \`Trip\` t
       JOIN \`Route\` r ON r.id = t.route_id
       WHERE t.id = ?
       LIMIT 1`,
      [tripId]
    )
    const trip = tripRows && tripRows[0]
    if (!trip) return res.status(404).json({ error: 'trip not found' })

    if (role !== 'ADMIN') {
      if (!ctx.agencyId) return res.status(403).json({ error: 'agency not assigned' })
      if (Number(operator.agencyId) !== Number(ctx.agencyId) || Number(trip.agencyId) !== Number(ctx.agencyId)) {
        return res.status(403).json({ error: 'operator or trip does not belong to your agency' })
      }
    }

    if (Number(operator.agencyId) !== Number(trip.agencyId)) {
      return res.status(400).json({ error: 'operator and trip belong to different agencies' })
    }

    const accessCode = requestedCode || buildScannerCode()
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + 8 * 60 * 60 * 1000)

    await query(
      'UPDATE `ScannerSession` SET status = ?, ended_at = NOW(), updated_at = NOW() WHERE user_id = ? AND status = ?',
      ['CLOSED', operatorUserId, 'ACTIVE']
    )

    const ins: any = await query(
      `INSERT INTO \`ScannerSession\`
       (user_id, agency_worker_id, agency_id, trip_id, access_code, status, started_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, NOW(), NOW())`,
      [operatorUserId, operator.id, trip.agencyId || null, tripId, accessCode, startedAt, expiresAt]
    )

    const sessionRows: any = await query(
      `SELECT s.id, s.user_id AS userId, s.trip_id AS tripId, s.agency_id AS agencyId,
              s.access_code AS accessCode, s.status, s.started_at AS startedAt,
              s.expires_at AS expiresAt, s.ended_at AS endedAt,
              r.code AS routeCode, r.origin, r.destination,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
       FROM \`ScannerSession\` s
       JOIN \`Trip\` t ON t.id = s.trip_id
       JOIN \`Route\` r ON r.id = t.route_id
       WHERE s.id = ? LIMIT 1`,
      [ins?.insertId]
    )

    res.json({
      success: true,
      operator: {
        userId: operator.userId,
        email: operator.email,
        name: operator.name,
        agencyId: operator.agencyId,
      },
      session: sessionRows && sessionRows[0] ? sessionRows[0] : null,
    })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.get('/scanner/trips', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const ctx = await getVerifierContext(payload)
    if (!ctx.canVerify) return res.status(403).json({ error: 'forbidden' })

    const params: any[] = []
    const where: string[] = ['t.departure_at >= DATE_SUB(NOW(), INTERVAL 6 HOUR)']

    if (ctx.role !== 'ADMIN') {
      if (!ctx.agencyId) return res.status(403).json({ error: 'agency not assigned' })
      where.push('r.agency_id = ?')
      params.push(ctx.agencyId)
    }

    if (req.query?.date) {
      where.push('DATE(t.departure_at) = DATE(?)')
      params.push(String(req.query.date))
    }

    if (ctx.role === 'USER') {
      const allowedTripIds = await getOperatorAllowedTripIds(ctx.verifierUserId)
      if (allowedTripIds.length === 0) {
        return res.json({ trips: [] })
      }
      const placeholders = allowedTripIds.map(() => '?').join(',')
      where.push(`t.id IN (${placeholders})`)
      params.push(...allowedTripIds)
    }

    const rows: any = await query(
      `SELECT t.id, DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt, t.status,
              t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice,
              r.id AS routeId, r.code AS routeCode, r.origin, r.destination,
              r.agency_id AS agencyId,
              b.id AS busId, b.plate AS busPlate,
              a.name AS agencyName
       FROM \`Trip\` t
       JOIN \`Route\` r ON r.id = t.route_id
       LEFT JOIN \`Bus\` b ON b.id = t.bus_id
       LEFT JOIN \`Agency\` a ON a.id = r.agency_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.departure_at ASC
       LIMIT 200`,
      params
    )

    res.json({ trips: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.post('/scanner/start-session', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const ctx = await getVerifierContext(payload)
    if (!ctx.canVerify) return res.status(403).json({ error: 'forbidden' })

    const tripId = Number(req.body?.tripId)
    const requestedCode = String(req.body?.accessCode || '').trim().toUpperCase()
    if (!tripId) return res.status(400).json({ error: 'tripId required' })

    const tripRows: any = await query(
      `SELECT t.id, r.agency_id AS agencyId, r.origin, r.destination, r.code AS routeCode,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
       FROM \`Trip\` t
       JOIN \`Route\` r ON r.id = t.route_id
       WHERE t.id = ? LIMIT 1`,
      [tripId]
    )
    const trip = tripRows && tripRows[0]
    if (!trip) return res.status(404).json({ error: 'trip not found' })

    if (ctx.role !== 'ADMIN') {
      if (!ctx.agencyId || Number(trip.agencyId) !== Number(ctx.agencyId)) {
        return res.status(403).json({ error: 'trip does not belong to your agency' })
      }
    }

    if (ctx.role === 'USER') {
      const hasTripAccess = await ensureOperatorTripAccess(ctx.verifierUserId, tripId)
      if (!hasTripAccess) {
        return res.status(403).json({ error: 'trip not assigned to operator' })
      }
    }

    const existingRows: any = await query(
      `SELECT s.id, s.user_id AS userId, s.trip_id AS tripId, s.agency_id AS agencyId,
              s.access_code AS accessCode, s.status, s.started_at AS startedAt,
              s.expires_at AS expiresAt, s.ended_at AS endedAt,
              r.code AS routeCode, r.origin, r.destination,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
       FROM \`ScannerSession\` s
       JOIN \`Trip\` t ON t.id = s.trip_id
       JOIN \`Route\` r ON r.id = t.route_id
       WHERE s.user_id = ? AND s.trip_id = ? AND s.status = 'ACTIVE' AND (s.expires_at IS NULL OR s.expires_at >= NOW())
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [ctx.verifierUserId, tripId]
    )
    if (existingRows && existingRows[0]) {
      return res.json({ success: true, reused: true, session: existingRows[0] })
    }

    const accessCode = requestedCode || buildScannerCode()
    const startedAt = new Date()
    const expiresAt = new Date(startedAt.getTime() + 8 * 60 * 60 * 1000)

    await query(
      'UPDATE `ScannerSession` SET status = ?, ended_at = NOW(), updated_at = NOW() WHERE user_id = ? AND status = ?',
      ['CLOSED', ctx.verifierUserId, 'ACTIVE']
    )

    const ins: any = await query(
      `INSERT INTO \`ScannerSession\`
       (user_id, agency_worker_id, agency_id, trip_id, access_code, status, started_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?, NOW(), NOW())`,
      [ctx.verifierUserId, ctx.agencyWorkerId, trip.agencyId || null, tripId, accessCode, startedAt, expiresAt]
    )

    const sessionRows: any = await query(
      `SELECT s.id, s.user_id AS userId, s.trip_id AS tripId, s.agency_id AS agencyId,
              s.access_code AS accessCode, s.status, s.started_at AS startedAt,
              s.expires_at AS expiresAt, s.ended_at AS endedAt,
              r.code AS routeCode, r.origin, r.destination,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
       FROM \`ScannerSession\` s
       JOIN \`Trip\` t ON t.id = s.trip_id
       JOIN \`Route\` r ON r.id = t.route_id
       WHERE s.id = ? LIMIT 1`,
      [ins?.insertId]
    )

    res.json({ success: true, session: sessionRows && sessionRows[0] })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.post('/preview-qr', authenticate, async (req: any, res) => {
  const { qrPayload, tripId: requestedTripId, scannerSessionId, accessCode } = req.body || {}
  const payload = req.user
  const ctx = await getVerifierContext(payload)
  if (!ctx.canVerify) return res.status(403).json({ error: 'forbidden' })

  const verifierUserId = ctx.verifierUserId

  let ticketUuid: string | null = null
  let tripIdFromQr: number | null = null

  if (!qrPayload) return res.status(400).json({ error: 'qrPayload required' })

  try {
    const decoded = jwt.verify(qrPayload, JWT_SECRET)
    if (decoded && typeof decoded === 'object') {
      ticketUuid = String((decoded as any).ticketUuid || (decoded as any).uuid || null)
      tripIdFromQr = (decoded as any).tripId ? Number((decoded as any).tripId) : null
    }
  } catch (e) {
    try {
      const parsed = JSON.parse(qrPayload)
      ticketUuid = parsed.ticketUuid || parsed.uuid || null
      tripIdFromQr = parsed.tripId ? Number(parsed.tripId) : tripIdFromQr
    } catch (e) {
      ticketUuid = qrPayload
    }
  }

  if (!ticketUuid) return res.status(400).json({ error: 'unable to extract ticket id from QR payload' })

  try {
    const result = await transaction(async (tx: any) => {
      let activeSession: any = null
      const providedCode = String(accessCode || '').trim().toUpperCase()

      if (scannerSessionId) {
        const [sessionRows]: any = await tx.query(
          `SELECT id, user_id AS userId, agency_id AS agencyId, trip_id AS tripId, access_code AS accessCode, status, expires_at AS expiresAt
           FROM \`ScannerSession\`
           WHERE id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at >= NOW())
           LIMIT 1`,
          [Number(scannerSessionId)]
        )
        activeSession = sessionRows && sessionRows[0]
      } else if (providedCode) {
        const [sessionRows]: any = await tx.query(
          `SELECT id, user_id AS userId, agency_id AS agencyId, trip_id AS tripId, access_code AS accessCode, status, expires_at AS expiresAt
           FROM \`ScannerSession\`
           WHERE access_code = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at >= NOW())
           ORDER BY started_at DESC
           LIMIT 1`,
          [providedCode]
        )
        activeSession = sessionRows && sessionRows[0]
      } else {
        const [sessionRows]: any = await tx.query(
          `SELECT id, user_id AS userId, agency_id AS agencyId, trip_id AS tripId, access_code AS accessCode, status, expires_at AS expiresAt
           FROM \`ScannerSession\`
           WHERE user_id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at >= NOW())
           ORDER BY started_at DESC
           LIMIT 1`,
          [verifierUserId]
        )
        activeSession = sessionRows && sessionRows[0]
      }

      if (!activeSession) throw new Error('No active scanner session. Select a trip first')
      if (activeSession.status !== 'ACTIVE') throw new Error('Scanner session is not active')
      if (activeSession.expiresAt && new Date(activeSession.expiresAt).getTime() < Date.now()) {
        throw new Error('Scanner session expired')
      }
      if (ctx.role !== 'ADMIN' && Number(activeSession.userId) !== Number(verifierUserId)) {
        throw new Error('Scanner session does not belong to your user')
      }

      const [ticketRows]: any = await tx.query(
        'SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.seat_number AS seatNumber, t.price, t.status, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, t.verification_count AS verificationCount, o.user_id AS purchaserUserId, o.reference_code AS referenceCode, DATE_FORMAT(tr.departure_at, \'%Y-%m-%d %H:%i:%s\') AS departureAt, DATE_FORMAT(tr.arrival_at, \'%Y-%m-%d %H:%i:%s\') AS arrivalAt, r.origin, r.destination, r.code AS routeCode FROM `Ticket` t LEFT JOIN `Order` o ON o.id = t.order_id LEFT JOIN `Trip` tr ON tr.id = t.trip_id LEFT JOIN `Route` r ON r.id = tr.route_id WHERE t.uuid = ? LIMIT 1',
        [ticketUuid]
      )
      const ticket = ticketRows && ticketRows[0]
      if (!ticket) throw new Error('Ticket not found')

      if (tripIdFromQr && ticket.tripId !== Number(tripIdFromQr)) throw new Error('Ticket does not belong to QR trip')
      if (requestedTripId && ticket.tripId !== Number(requestedTripId)) throw new Error('Ticket does not belong to selected trip')
      if (ticket.tripId !== Number(activeSession.tripId)) throw new Error('Ticket does not belong to active scanner trip')

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

      return {
        ok: true,
        session: {
          id: activeSession.id,
          tripId: activeSession.tripId,
          accessCode: activeSession.accessCode,
        },
        ticket: {
          uuid: ticket.uuid,
          passengerName: ticket.passengerName || null,
          passengerIdentification: ticket.passengerIdentification || null,
          passengerPhone: ticket.passengerPhone || null,
          routeCode: ticket.routeCode || null,
          origin: ticket.origin || null,
          destination: ticket.destination || null,
          departureAt: ticket.departureAt || null,
          arrivalAt: ticket.arrivalAt || null,
          referenceCode: ticket.referenceCode || null,
          status: ticket.status || null
        },
        passengers: orderPassengers
      }
    })
    res.json(result)
  } catch (e: any) {
    res.status(400).json({ error: String(e.message || e) })
  }
})

router.get('/scanner/active-session', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const ctx = await getVerifierContext(payload)
    if (!ctx.canVerify) return res.status(403).json({ error: 'forbidden' })

    const rows: any = await query(
      `SELECT s.id, s.user_id AS userId, s.trip_id AS tripId, s.agency_id AS agencyId,
              s.access_code AS accessCode, s.status, s.started_at AS startedAt,
              s.expires_at AS expiresAt, s.ended_at AS endedAt,
              r.code AS routeCode, r.origin, r.destination,
              DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt
       FROM \`ScannerSession\` s
       JOIN \`Trip\` t ON t.id = s.trip_id
       JOIN \`Route\` r ON r.id = t.route_id
       WHERE s.user_id = ? AND s.status = 'ACTIVE' AND (s.expires_at IS NULL OR s.expires_at >= NOW())
       ORDER BY s.started_at DESC
       LIMIT 1`,
      [ctx.verifierUserId]
    )

    res.json({ session: rows && rows[0] ? rows[0] : null })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.get('/scanner/trips/:tripId/passengers', authenticate, async (req: any, res) => {
  try {
    const payload = req.user
    const ctx = await getVerifierContext(payload)
    if (!ctx.canVerify) return res.status(403).json({ error: 'forbidden' })

    const tripId = Number(req.params.tripId)
    if (!tripId) return res.status(400).json({ error: 'invalid tripId' })

    const tripRows: any = await query(
      'SELECT t.id, r.agency_id AS agencyId, r.code AS routeCode, r.origin, r.destination, DATE_FORMAT(t.departure_at, \'%Y-%m-%d %H:%i:%s\') AS departureAt FROM `Trip` t JOIN `Route` r ON r.id = t.route_id WHERE t.id = ? LIMIT 1',
      [tripId]
    )
    const trip = tripRows && tripRows[0]
    if (!trip) return res.status(404).json({ error: 'trip not found' })

    if (ctx.role !== 'ADMIN') {
      if (!ctx.agencyId || Number(trip.agencyId) !== Number(ctx.agencyId)) {
        return res.status(403).json({ error: 'trip does not belong to your agency' })
      }
    }

    const rows: any = await query(
      `SELECT t.uuid, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification,
              t.passenger_phone AS passengerPhone, t.status, t.verified_at AS verifiedAt,
              o.reference_code AS referenceCode
       FROM \`Ticket\` t
       LEFT JOIN \`Order\` o ON o.id = t.order_id
       WHERE t.trip_id = ?
       ORDER BY t.id ASC`,
      [tripId]
    )

    res.json({ trip, passengers: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e.message || e) })
  }
})

router.post('/verify-qr', authenticate, async (req: any, res) => {
  const { qrPayload, presentedId, tripId: requestedTripId, scannerSessionId, accessCode } = req.body || {}
  const payload = req.user
  const ctx = await getVerifierContext(payload)
  if (!ctx.canVerify) return res.status(403).json({ error: 'forbidden' })

  const verifierUserId = ctx.verifierUserId

  let ticketUuid: string | null = null
  let tripIdFromQr: number | null = null

  if (!qrPayload) return res.status(400).json({ error: 'qrPayload required' })

  try {
    const decoded = jwt.verify(qrPayload, JWT_SECRET)
    if (decoded && typeof decoded === 'object') {
      ticketUuid = String((decoded as any).ticketUuid || (decoded as any).uuid || null)
      tripIdFromQr = (decoded as any).tripId ? Number((decoded as any).tripId) : null
    }
  } catch (e) {
    try {
      const parsed = JSON.parse(qrPayload)
      ticketUuid = parsed.ticketUuid || parsed.uuid || null
      tripIdFromQr = parsed.tripId ? Number(parsed.tripId) : tripIdFromQr
    } catch (e) {
      ticketUuid = qrPayload
    }
  }

  if (!ticketUuid) return res.status(400).json({ error: 'unable to extract ticket id from QR payload' })

  try {
    const result = await transaction(async (tx: any) => {
      let activeSession: any = null
      const requestedSessionId = Number(scannerSessionId || 0)
      const providedCode = String(accessCode || '').trim().toUpperCase()

      if (requestedSessionId) {
        const [sessionRows]: any = await tx.query(
          'SELECT id, user_id AS userId, agency_id AS agencyId, trip_id AS tripId, access_code AS accessCode, status, expires_at AS expiresAt FROM `ScannerSession` WHERE id = ? LIMIT 1',
          [requestedSessionId]
        )
        activeSession = sessionRows && sessionRows[0]
      } else if (providedCode) {
        const [sessionRows]: any = await tx.query(
          `SELECT id, user_id AS userId, agency_id AS agencyId, trip_id AS tripId, access_code AS accessCode, status, expires_at AS expiresAt
           FROM \`ScannerSession\`
           WHERE access_code = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at >= NOW())
           ORDER BY started_at DESC
           LIMIT 1`,
          [providedCode]
        )
        activeSession = sessionRows && sessionRows[0]
      } else {
        const [sessionRows]: any = await tx.query(
          `SELECT id, user_id AS userId, agency_id AS agencyId, trip_id AS tripId, access_code AS accessCode, status, expires_at AS expiresAt
           FROM \`ScannerSession\`
           WHERE user_id = ? AND status = 'ACTIVE' AND (expires_at IS NULL OR expires_at >= NOW())
           ORDER BY started_at DESC
           LIMIT 1`,
          [verifierUserId]
        )
        activeSession = sessionRows && sessionRows[0]
      }

      if (!activeSession) throw new Error('No active scanner session. Select a trip first')
      if (activeSession.status !== 'ACTIVE') throw new Error('Scanner session is not active')
      if (activeSession.expiresAt && new Date(activeSession.expiresAt).getTime() < Date.now()) {
        throw new Error('Scanner session expired')
      }

      if (ctx.role !== 'ADMIN' && Number(activeSession.userId) !== Number(verifierUserId)) {
        throw new Error('Scanner session does not belong to your user')
      }

      const [ticketRows]: any = await tx.query(
        'SELECT t.id, t.uuid, t.order_id AS orderId, t.trip_id AS tripId, t.passenger_name AS passengerName, t.passenger_identification AS passengerIdentification, t.passenger_phone AS passengerPhone, t.is_contact AS isContact, t.seat_number AS seatNumber, t.price, t.status, t.expires_at AS expiresAt, t.issued_at AS issuedAt, t.verified_at AS verifiedAt, t.verified_by_id AS verifiedById, t.qr_token AS qrToken, t.verification_count AS verificationCount, o.user_id AS purchaserUserId, o.reference_code AS referenceCode, DATE_FORMAT(tr.departure_at, \'%Y-%m-%d %H:%i:%s\') AS departureAt, DATE_FORMAT(tr.arrival_at, \'%Y-%m-%d %H:%i:%s\') AS arrivalAt, r.origin, r.destination, r.code AS routeCode FROM `Ticket` t LEFT JOIN `Order` o ON o.id = t.order_id LEFT JOIN `Trip` tr ON tr.id = t.trip_id LEFT JOIN `Route` r ON r.id = tr.route_id WHERE t.uuid = ? LIMIT 1',
        [ticketUuid]
      )
      const ticket = ticketRows && ticketRows[0]
      if (!ticket) throw new Error('Ticket not found')

      if (tripIdFromQr && ticket.tripId !== Number(tripIdFromQr)) throw new Error('Ticket does not belong to QR trip')
      if (requestedTripId && ticket.tripId !== Number(requestedTripId)) throw new Error('Ticket does not belong to selected trip')
      if (ticket.tripId !== Number(activeSession.tripId)) throw new Error('Ticket does not belong to active scanner trip')

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

      await tx.query(
        'INSERT INTO `VerificationLog` (ticket_id, checked_by_user_id, agency_worker_id, result, device_info, location) VALUES (?, ?, ?, ?, ?, ?)',
        [ticket.id, verifierUserId, ctx.agencyWorkerId, 'OK', JSON.stringify({ scannerSessionId: activeSession.id, accessCode: activeSession.accessCode }), null]
      )

      return {
        ok: true,
        session: {
          id: activeSession.id,
          tripId: activeSession.tripId,
          accessCode: activeSession.accessCode,
        },
        ticket: {
          uuid: ticket.uuid,
          passengerName: ticket.passengerName || null,
          passengerIdentification: ticket.passengerIdentification || null,
          passengerPhone: ticket.passengerPhone || null,
          routeCode: ticket.routeCode || null,
          origin: ticket.origin || null,
          destination: ticket.destination || null,
          departureAt: ticket.departureAt || null,
          arrivalAt: ticket.arrivalAt || null,
          referenceCode: ticket.referenceCode || null,
          status: 'USED'
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
