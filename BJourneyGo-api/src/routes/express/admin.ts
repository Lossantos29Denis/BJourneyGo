import { Router } from 'express'
import fs from 'fs'
import path from 'path'
import multer from 'multer'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { query, transaction } from '../../lib/db'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'
const maxUploadBytes = Number(process.env.DOCS_MAX_UPLOAD_BYTES || 25 * 1024 * 1024)
const uploadsRoot = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
const documentsDir = path.join(uploadsRoot, 'documents')
fs.mkdirSync(documentsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, documentsDir),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ext && ext.length <= 8 ? ext : ''
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`
    cb(null, name)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: maxUploadBytes }
})

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'unauthorized' })
  const token = auth.replace('Bearer ', '')
  try {
    const payload: any = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' })
  }
}

function requireAdmin(req: any, res: any, next: any) {
  if (!isAdmin(req.user?.role)) {
    if (isAgency(req.user?.role)) return res.status(403).json({ error: 'forbidden: admin only' })
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

function requireAdminOrAgency(req: any, res: any, next: any) {
  if (!isAdmin(req.user?.role) && !isAgency(req.user?.role)) return res.status(403).json({ error: 'forbidden' })
  next()
}

async function getAgencyId(userId: number) {
  const rows: any = await query('SELECT agency_id AS agencyId FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [userId])
  return rows && rows[0] ? rows[0].agencyId : null
}

function isAdmin(role?: string) {
  return role === 'ADMIN'
}

function isAgency(role?: string) {
  return role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER'
}

function mapAgencyWorkerRole(role?: string) {
  if (role === 'SCANNER') return 'STAFF'
  return role === 'AGENCY_ADMIN' ? 'MANAGER' : 'STAFF'
}

function mapAgencyWorkerScannerEnabled(role?: string) {
  return role === 'SCANNER' ? 1 : 0
}

function serializeAddress(address: any) {
  if (!address) return null
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address)
      return JSON.stringify(parsed)
    } catch (e) {
      return JSON.stringify({ line1: address })
    }
  }
  return JSON.stringify(address)
}

function normalizeCommissionPercent(value: any, fallback: number | null) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0 || parsed > 100) return null
  return parsed
}

function parseDateTimeInput(value: any) {
  if (typeof value !== 'string') return null
  const raw = value.trim()
  if (!raw) return null

  const localMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T\s](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (localMatch) {
    const year = Number(localMatch[1])
    const month = Number(localMatch[2])
    const day = Number(localMatch[3])
    const hour = Number(localMatch[4])
    const minute = Number(localMatch[5])
    const second = Number(localMatch[6] || '0')
    const d = new Date(year, month - 1, day, hour, minute, second)
    if (Number.isNaN(d.getTime())) return null
    return d
  }

  const parsed = new Date(raw)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toSqlDateTime(value: Date) {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const dd = String(value.getDate()).padStart(2, '0')
  const hh = String(value.getHours()).padStart(2, '0')
  const mi = String(value.getMinutes()).padStart(2, '0')
  const ss = String(value.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

async function getUserAgencyId(userId: number) {
  const rows: any = await query('SELECT agency_id AS agencyId FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [userId])
  return rows && rows[0] ? rows[0].agencyId : null
}

function parseJson(value: any) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (e) {
    return null
  }
}

// GET /admin/routes
router.get('/routes', requireAuth, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    let rows: any
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      rows = await query('SELECT id, code, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status, agency_id AS agencyId FROM `Route` WHERE agency_id = ? ORDER BY origin, destination', [agencyId])
    } else {
      rows = await query('SELECT id, code, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status, agency_id AS agencyId FROM `Route` ORDER BY origin, destination')
    }
    res.json({ routes: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/routes
router.post('/routes', requireAuth, async (req: any, res) => {
  try {
    const { code, origin, destination, distanceKm, durationMinutes, status, agencyId } = req.body || {}
    if (!code || !origin || !destination) return res.status(400).json({ error: 'code, origin, destination required' })
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    let agency = agencyId ? Number(agencyId) : null
    if (isAgency(role)) agency = await getAgencyId(userId)
    if (isAgency(role) && !agency) return res.status(400).json({ error: 'agencyId required' })

    const result: any = await query('INSERT INTO `Route` (code, agency_id, origin, destination, distance_km, duration_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())', [code, agency, origin, destination, distanceKm || null, durationMinutes || null, status || 'ACTIVE'])
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/routes/:id
router.put('/routes/:id', requireAuth, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    const { code, origin, destination, distanceKm, durationMinutes, status, basePrice } = req.body || {}
    if (!id) return res.status(400).json({ error: 'invalid id' })

    await query('UPDATE `Route` SET code = COALESCE(?, code), origin = COALESCE(?, origin), destination = COALESCE(?, destination), distance_km = COALESCE(?, distance_km), duration_minutes = COALESCE(?, duration_minutes), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?', [code || null, origin || null, destination || null, distanceKm || null, durationMinutes || null, status || null, id])

    // Route does not own a price column; when provided, propagate to trips.
    if (basePrice !== undefined && basePrice !== null && basePrice !== '') {
      const nextBasePrice = Number(basePrice)
      if (!Number.isFinite(nextBasePrice) || nextBasePrice < 0) {
        return res.status(400).json({ error: 'invalid basePrice' })
      }
      await query('UPDATE `Trip` SET base_price = ?, updated_at = NOW() WHERE route_id = ?', [nextBasePrice, id])
    }

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/routes/:id
router.delete('/routes/:id', requireAuth, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    await query('DELETE FROM `Route` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/trips
router.get('/trips', requireAuth, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    const where: string[] = []
    const params: any[] = []
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      where.push('r.agency_id = ?')
      params.push(agencyId)
    }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const rows: any = await query(`SELECT t.id, t.route_id AS routeId, r.code AS routeCode, r.origin, r.destination, t.bus_id AS busId, DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice, t.status FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id ${clause} ORDER BY t.departure_at DESC`, params)
    res.json({ trips: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/trips
router.post('/trips', requireAuth, async (req: any, res) => {
  try {
    const { routeId, busId, departureAt, arrivalAt, capacity, basePrice, status } = req.body || {}
    if (!routeId || !departureAt || !arrivalAt) return res.status(400).json({ error: 'routeId, departureAt, arrivalAt required' })
    const parsedDeparture = parseDateTimeInput(departureAt)
    const parsedArrival = parseDateTimeInput(arrivalAt)
    if (!parsedDeparture || !parsedArrival) return res.status(400).json({ error: 'invalid departureAt/arrivalAt' })
    if (parsedArrival.getTime() <= parsedDeparture.getTime()) {
      return res.status(400).json({ error: 'arrivalAt must be after departureAt' })
    }
    const role = req.user?.role
    const userId = Number(req.user?.userId)

    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      const routes: any = await query('SELECT id FROM `Route` WHERE id = ? AND agency_id = ? LIMIT 1', [routeId, agencyId])
      if (!routes || routes.length === 0) return res.status(403).json({ error: 'route not allowed' })
      if (busId) {
        const buses: any = await query('SELECT id FROM `Bus` WHERE id = ? AND agency_id = ? LIMIT 1', [busId, agencyId])
        if (!buses || buses.length === 0) return res.status(403).json({ error: 'bus not allowed' })
      }
    }

    const result: any = await query(
      'INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [routeId, busId || null, toSqlDateTime(parsedDeparture), toSqlDateTime(parsedArrival), capacity || 0, basePrice || 0, status || 'SCHEDULED']
    )
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/trips/roundtrip
router.post('/trips/roundtrip', requireAuth, async (req: any, res) => {
  try {
    const outbound = req.body?.outbound || {}
    const ret = req.body?.returnTrip || {}

    const outboundRouteId = Number(outbound.routeId || 0)
    const outboundBusId = outbound.busId ? Number(outbound.busId) : null
    const outboundDepartureRaw = String(outbound.departureAt || '')
    const outboundArrivalRaw = String(outbound.arrivalAt || '')
    const outboundCapacity = Number(outbound.capacity || 0)
    const outboundPrice = Number(outbound.basePrice || 0)
    const outboundStatus = String(outbound.status || 'SCHEDULED')

    const returnRouteId = Number(ret.routeId || 0)
    const returnBusId = ret.busId ? Number(ret.busId) : null
    const returnDepartureRaw = String(ret.departureAt || '')
    const returnArrivalRaw = String(ret.arrivalAt || '')
    const returnCapacity = Number(ret.capacity || 0)
    const returnPrice = Number(ret.basePrice || 0)
    const returnStatus = String(ret.status || 'SCHEDULED')

    if (!outboundRouteId || !outboundDepartureRaw || !outboundArrivalRaw || !returnRouteId || !returnDepartureRaw || !returnArrivalRaw) {
      return res.status(400).json({ error: 'outbound and returnTrip routeId/departureAt/arrivalAt are required' })
    }

    const outboundDeparture = parseDateTimeInput(outboundDepartureRaw)
    const outboundArrival = parseDateTimeInput(outboundArrivalRaw)
    const returnDeparture = parseDateTimeInput(returnDepartureRaw)
    const returnArrival = parseDateTimeInput(returnArrivalRaw)

    if (!outboundDeparture || !outboundArrival || !returnDeparture || !returnArrival) {
      return res.status(400).json({ error: 'invalid departureAt/arrivalAt in outbound or returnTrip' })
    }
    if (outboundArrival.getTime() <= outboundDeparture.getTime()) {
      return res.status(400).json({ error: 'outbound arrivalAt must be after departureAt' })
    }
    if (returnArrival.getTime() <= returnDeparture.getTime()) {
      return res.status(400).json({ error: 'return arrivalAt must be after departureAt' })
    }

    const role = req.user?.role
    const userId = Number(req.user?.userId)

    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      const routeRows: any = await query(
        'SELECT id FROM `Route` WHERE id IN (?, ?) AND agency_id = ?',
        [outboundRouteId, returnRouteId, agencyId]
      )
      const routeSet = new Set((routeRows || []).map((r: any) => Number(r.id)))
      if (!routeSet.has(outboundRouteId) || !routeSet.has(returnRouteId)) {
        return res.status(403).json({ error: 'route not allowed' })
      }

      const busIds = [outboundBusId, returnBusId].filter((v) => Number(v) > 0)
      if (busIds.length > 0) {
        const busPlaceholders = busIds.map(() => '?').join(',')
        const buses: any = await query(
          `SELECT id FROM \`Bus\` WHERE id IN (${busPlaceholders}) AND agency_id = ?`,
          [...busIds, agencyId]
        )
        const busSet = new Set((buses || []).map((b: any) => Number(b.id)))
        for (const bid of busIds) {
          if (!busSet.has(Number(bid))) return res.status(403).json({ error: 'bus not allowed' })
        }
      }
    }

    const result = await transaction(async (tx: any) => {
      const [outboundIns]: any = await tx.query(
        'INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [outboundRouteId, outboundBusId || null, toSqlDateTime(outboundDeparture), toSqlDateTime(outboundArrival), outboundCapacity || 0, outboundPrice || 0, outboundStatus || 'SCHEDULED']
      )

      const [returnIns]: any = await tx.query(
        'INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
        [returnRouteId, returnBusId || null, toSqlDateTime(returnDeparture), toSqlDateTime(returnArrival), returnCapacity || 0, returnPrice || 0, returnStatus || 'SCHEDULED']
      )

      return {
        outboundTripId: outboundIns?.insertId,
        returnTripId: returnIns?.insertId,
      }
    })

    res.json({ success: true, ...result })
  } catch (e: any) {
    res.status(500).json({ error: String(e?.message || e) })
  }
})

// PUT /admin/trips/:id
router.put('/trips/:id', requireAuth, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    const { departureAt, arrivalAt, capacity, basePrice, status } = req.body || {}
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const parsedDeparture = departureAt === undefined ? null : parseDateTimeInput(departureAt)
    const parsedArrival = arrivalAt === undefined ? null : parseDateTimeInput(arrivalAt)
    if (departureAt !== undefined && !parsedDeparture) return res.status(400).json({ error: 'invalid departureAt' })
    if (arrivalAt !== undefined && !parsedArrival) return res.status(400).json({ error: 'invalid arrivalAt' })

    if (parsedDeparture || parsedArrival) {
      const rows: any = await query('SELECT departure_at AS departureAt, arrival_at AS arrivalAt FROM `Trip` WHERE id = ? LIMIT 1', [id])
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'trip not found' })
      const effectiveDeparture = parsedDeparture || parseDateTimeInput(rows[0].departureAt)
      const effectiveArrival = parsedArrival || parseDateTimeInput(rows[0].arrivalAt)
      if (!effectiveDeparture || !effectiveArrival) return res.status(400).json({ error: 'invalid trip schedule data' })
      if (effectiveArrival.getTime() <= effectiveDeparture.getTime()) {
        return res.status(400).json({ error: 'arrivalAt must be after departureAt' })
      }
    }

    const nextCapacity = capacity === undefined ? null : Number(capacity)
    const nextBasePrice = basePrice === undefined ? null : Number(basePrice)
    if (nextCapacity !== null && (!Number.isFinite(nextCapacity) || nextCapacity < 0)) {
      return res.status(400).json({ error: 'invalid capacity' })
    }
    if (nextBasePrice !== null && (!Number.isFinite(nextBasePrice) || nextBasePrice < 0)) {
      return res.status(400).json({ error: 'invalid basePrice' })
    }
    await query('UPDATE `Trip` SET departure_at = COALESCE(?, departure_at), arrival_at = COALESCE(?, arrival_at), capacity = COALESCE(?, capacity), base_price = COALESCE(?, base_price), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?', [parsedDeparture ? toSqlDateTime(parsedDeparture) : null, parsedArrival ? toSqlDateTime(parsedArrival) : null, nextCapacity, nextBasePrice, status || null, id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/trips/:id
router.delete('/trips/:id', requireAuth, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    await query('DELETE FROM `Trip` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/buses
router.get('/buses', requireAuth, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    let rows: any
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      rows = await query('SELECT id, plate, agency_id AS agencyId, capacity FROM `Bus` WHERE agency_id = ? ORDER BY id', [agencyId])
    } else {
      rows = await query('SELECT id, plate, agency_id AS agencyId, capacity FROM `Bus` ORDER BY id')
    }
    res.json({ buses: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/shift-users
router.get('/shift-users', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    let rows: any
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      rows = await query(
        `SELECT u.id, u.name, u.email, u.role, aw.agency_id AS agencyId
         FROM \`User\` u
         JOIN \`AgencyWorker\` aw ON aw.user_id = u.id
         WHERE aw.agency_id = ? AND aw.active = 1
         ORDER BY u.name`,
        [agencyId]
      )
    } else {
      rows = await query('SELECT id, name, email, role FROM `User` ORDER BY name')
    }
    res.json({ users: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/shifts
router.get('/shifts', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    const month = String(req.query.month || '')
    let startDate: Date | null = null
    let endDate: Date | null = null
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split('-').map(Number)
      startDate = new Date(year, mon - 1, 1)
      endDate = new Date(year, mon, 1)
    }

    const where: string[] = []
    const params: any[] = []
    if (startDate && endDate) {
      where.push('s.shift_date >= ? AND s.shift_date < ?')
      params.push(startDate, endDate)
    }
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      where.push('s.agency_id = ?')
      params.push(agencyId)
    } else if (req.query.agencyId) {
      where.push('s.agency_id = ?')
      params.push(Number(req.query.agencyId))
    }

    const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const rows: any = await query(
      `SELECT s.id, s.user_id AS userId, s.agency_id AS agencyId, s.shift_date AS shiftDate, s.shift_type AS shiftType, s.notes,
              u.name AS userName, u.email AS userEmail, u.role AS userRole
       FROM \`Shift\` s
       JOIN \`User\` u ON u.id = s.user_id
       ${clause}
       ORDER BY s.shift_date ASC`,
      params
    )
    res.json({ shifts: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/shifts
router.post('/shifts', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const { userId, shiftDate, shiftType, notes, agencyId } = req.body || {}
    if (!userId || !shiftDate || !shiftType) return res.status(400).json({ error: 'userId, shiftDate, shiftType required' })
    const role = req.user?.role
    const requesterId = Number(req.user?.userId)

    let agency = agencyId ? Number(agencyId) : null
    if (isAgency(role)) {
      agency = await getAgencyId(requesterId)
    }

    const userAgencyId = await getUserAgencyId(Number(userId))
    if (isAgency(role) && userAgencyId !== agency) return res.status(403).json({ error: 'user not in agency' })
    if (!agency) agency = userAgencyId

    const result: any = await query(
      'INSERT INTO `Shift` (user_id, agency_id, shift_date, shift_type, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [userId, agency || null, shiftDate, shiftType, notes || null]
    )
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/shifts/:id
router.put('/shifts/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const role = req.user?.role
    const requesterId = Number(req.user?.userId)
    if (isAgency(role)) {
      const agencyId = await getAgencyId(requesterId)
      const rows: any = await query('SELECT id FROM `Shift` WHERE id = ? AND agency_id = ? LIMIT 1', [id, agencyId])
      if (!rows || rows.length === 0) return res.status(403).json({ error: 'not allowed' })
    }
    const { shiftDate, shiftType, notes } = req.body || {}
    await query(
      'UPDATE `Shift` SET shift_date = COALESCE(?, shift_date), shift_type = COALESCE(?, shift_type), notes = COALESCE(?, notes), updated_at = NOW() WHERE id = ?',
      [shiftDate || null, shiftType || null, notes || null, id]
    )
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/shifts/:id
router.delete('/shifts/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const role = req.user?.role
    const requesterId = Number(req.user?.userId)
    if (isAgency(role)) {
      const agencyId = await getAgencyId(requesterId)
      const rows: any = await query('SELECT id FROM `Shift` WHERE id = ? AND agency_id = ? LIMIT 1', [id, agencyId])
      if (!rows || rows.length === 0) return res.status(403).json({ error: 'not allowed' })
    }
    await query('DELETE FROM `Shift` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/calendar-events
router.get('/calendar-events', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const userId = Number(req.user?.userId)
    const month = String(req.query.month || '')
    let startDate: Date | null = null
    let endDate: Date | null = null
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [year, mon] = month.split('-').map(Number)
      startDate = new Date(year, mon - 1, 1)
      endDate = new Date(year, mon, 1)
    }

    const where: string[] = ['e.user_id = ?']
    const params: any[] = [userId]
    if (startDate && endDate) {
      where.push('e.start_at >= ? AND e.start_at < ?')
      params.push(startDate, endDate)
    }

    const rows: any = await query(
      `SELECT e.id, e.user_id AS userId, e.agency_id AS agencyId, e.event_type AS eventType, e.title,
              e.start_at AS startAt, e.end_at AS endAt, e.details, e.created_at AS createdAt, e.updated_at AS updatedAt
       FROM \`CalendarEvent\` e
       WHERE ${where.join(' AND ')}
       ORDER BY e.start_at ASC`,
      params
    )
    const events = (rows || []).map((row: any) => ({
      ...row,
      details: parseJson(row.details)
    }))
    res.json({ events })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/calendar-events
router.post('/calendar-events', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const userId = Number(req.user?.userId)
    const { title, startAt, endAt, details } = req.body || {}
    if (!title || !startAt) return res.status(400).json({ error: 'title and startAt required' })

    const agencyId = await getUserAgencyId(userId)
    const result: any = await query(
      'INSERT INTO `CalendarEvent` (user_id, agency_id, event_type, title, start_at, end_at, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [userId, agencyId || null, 'APPOINTMENT', title, startAt, endAt || null, details ? JSON.stringify(details) : null]
    )
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/calendar-events/:id
router.put('/calendar-events/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const userId = Number(req.user?.userId)
    const rows: any = await query('SELECT id FROM `CalendarEvent` WHERE id = ? AND user_id = ? LIMIT 1', [id, userId])
    if (!rows || rows.length === 0) return res.status(403).json({ error: 'not allowed' })

    const { title, startAt, endAt, details } = req.body || {}
    await query(
      'UPDATE `CalendarEvent` SET title = COALESCE(?, title), start_at = COALESCE(?, start_at), end_at = COALESCE(?, end_at), details = COALESCE(?, details), updated_at = NOW() WHERE id = ?',
      [title || null, startAt || null, endAt || null, details ? JSON.stringify(details) : null, id]
    )
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/calendar-events/:id
router.delete('/calendar-events/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const userId = Number(req.user?.userId)
    const rows: any = await query('SELECT id FROM `CalendarEvent` WHERE id = ? AND user_id = ? LIMIT 1', [id, userId])
    if (!rows || rows.length === 0) return res.status(403).json({ error: 'not allowed' })
    await query('DELETE FROM `CalendarEvent` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/documents/upload
router.post('/documents/upload', requireAuth, requireAdmin, upload.single('file'), async (req: any, res) => {
  try {
    const file = req.file
    if (!file) return res.status(400).json({ error: 'file required' })
    const fileUrl = `/uploads/documents/${file.filename}`
    const fileSize = formatFileSize(file.size)
    res.json({ success: true, fileUrl, fileSize, originalName: file.originalname })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/documents
router.get('/documents', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    const where: string[] = []
    const params: any[] = []
    if (req.query.category) {
      where.push('category = ?')
      params.push(String(req.query.category))
    }
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      where.push('(agency_id IS NULL OR agency_id = ?)')
      params.push(agencyId)
    }
    const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
    const rows: any = await query(
      `SELECT id, agency_id AS agencyId, title, category, description, file_url AS fileUrl, file_size AS fileSize, created_at AS createdAt, updated_at AS updatedAt
       FROM \`Document\` ${clause} ORDER BY updated_at DESC`,
      params
    )
    res.json({ documents: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/documents
router.post('/documents', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { title, category, description, fileUrl, fileSize, agencyId } = req.body || {}
    if (!title) return res.status(400).json({ error: 'title required' })
    const result: any = await query(
      'INSERT INTO `Document` (agency_id, title, category, description, file_url, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [agencyId || null, title, category || 'RECURSOS', description || null, fileUrl || null, fileSize || null]
    )
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/documents/:id
router.put('/documents/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const { title, category, description, fileUrl, fileSize, agencyId } = req.body || {}
    await query(
      'UPDATE `Document` SET agency_id = COALESCE(?, agency_id), title = COALESCE(?, title), category = COALESCE(?, category), description = COALESCE(?, description), file_url = COALESCE(?, file_url), file_size = COALESCE(?, file_size), updated_at = NOW() WHERE id = ?',
      [agencyId || null, title || null, category || null, description || null, fileUrl || null, fileSize || null, id]
    )
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/documents/:id
router.delete('/documents/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    await query('DELETE FROM `Document` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/agencies
router.get('/agencies', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const rows: any = await query(
      'SELECT id, name, tax_id AS taxId, contact_email AS contactEmail, phone, address, stripe_account_id AS stripeAccountId, commission_percent AS commissionPercent, payout_active AS payoutActive, status, created_at AS createdAt, updated_at AS updatedAt FROM `Agency` ORDER BY name'
    )
    res.json({ agencies: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/agencies
router.post('/agencies', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { name, taxId, contactEmail, phone, address, stripeAccountId, commissionPercent, payoutActive, status } = req.body || {}
    if (!name) return res.status(400).json({ error: 'name required' })
    const normalizedCommission = normalizeCommissionPercent(commissionPercent, 10)
    if (normalizedCommission === null) return res.status(400).json({ error: 'commissionPercent must be between 0 and 100' })
    const addressJson = serializeAddress(address)
    const result: any = await query(
      'INSERT INTO `Agency` (name, tax_id, contact_email, phone, address, stripe_account_id, commission_percent, payout_active, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [name, taxId || null, contactEmail || null, phone || null, addressJson, stripeAccountId || null, normalizedCommission, payoutActive === undefined ? 1 : (payoutActive ? 1 : 0), status || 'ACTIVE']
    )
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/agencies/:id
router.put('/agencies/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const { name, taxId, contactEmail, phone, address, stripeAccountId, commissionPercent, payoutActive, status } = req.body || {}
    const normalizedCommission = normalizeCommissionPercent(commissionPercent, null)
    if (normalizedCommission === null && commissionPercent !== undefined && commissionPercent !== null && commissionPercent !== '') {
      return res.status(400).json({ error: 'commissionPercent must be between 0 and 100' })
    }
    const addressJson = address ? serializeAddress(address) : null
    await query(
      'UPDATE `Agency` SET name = COALESCE(?, name), tax_id = COALESCE(?, tax_id), contact_email = COALESCE(?, contact_email), phone = COALESCE(?, phone), address = COALESCE(?, address), stripe_account_id = COALESCE(?, stripe_account_id), commission_percent = COALESCE(?, commission_percent), payout_active = COALESCE(?, payout_active), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?',
      [name || null, taxId || null, contactEmail || null, phone || null, addressJson, stripeAccountId || null, normalizedCommission, payoutActive === undefined ? null : (payoutActive ? 1 : 0), status || null, id]
    )
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/agencies/:id
router.delete('/agencies/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    await query('DELETE FROM `Agency` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/stats
router.get('/stats', requireAuth, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    let agencyFilter = ''
    const params: any[] = [monthStart, monthEnd]
    let revenueRows: any = [{ revenue: 0 }]
    let ticketsRows: any = [{ tickets: 0 }]
    let customersRows: any = [{ customers: 0 }]
    let monthlySeries: any[] = []
    let salesDistribution: any[] = []
    let timeSlots: any[] = []
    let performanceMetrics: any = {}
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      agencyFilter = 'AND r.agency_id = ?'
      params.push(agencyId)
      revenueRows = await query(
        `SELECT COALESCE(SUM(tk.price),0) AS revenue
         FROM \`Ticket\` tk
         JOIN \`Order\` o ON o.id = tk.order_id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ? AND r.agency_id = ?`,
        [monthStart, monthEnd, agencyId]
      )
      ticketsRows = await query(
        `SELECT COUNT(*) AS tickets
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      )
      customersRows = await query(
        `SELECT COUNT(DISTINCT o.user_id) AS customers
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      )
      monthlySeries = (await query(
        `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS ym, COALESCE(SUM(tk.price),0) AS revenue
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ? AND r.agency_id = ?
         GROUP BY ym
         ORDER BY ym`,
        [seriesStart, monthEnd, agencyId]
      ) as any[])
      salesDistribution = (await query(
        `SELECT COALESCE(o.payment_method, 'OTROS') AS label, COUNT(*) AS value
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?
         GROUP BY label
         ORDER BY value DESC`,
        [agencyId]
      ) as any[])
      timeSlots = (await query(
        `SELECT
          SUM(CASE WHEN HOUR(t.departure_at) >= 6 AND HOUR(t.departure_at) < 9 THEN t.seats_sold ELSE 0 END) AS s1,
          SUM(CASE WHEN HOUR(t.departure_at) >= 9 AND HOUR(t.departure_at) < 12 THEN t.seats_sold ELSE 0 END) AS s2,
          SUM(CASE WHEN HOUR(t.departure_at) >= 12 AND HOUR(t.departure_at) < 15 THEN t.seats_sold ELSE 0 END) AS s3,
          SUM(CASE WHEN HOUR(t.departure_at) >= 15 AND HOUR(t.departure_at) < 18 THEN t.seats_sold ELSE 0 END) AS s4,
          SUM(CASE WHEN HOUR(t.departure_at) >= 18 AND HOUR(t.departure_at) < 21 THEN t.seats_sold ELSE 0 END) AS s5
         FROM \`Trip\` t
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])
      const purchaseRows: any = (await query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avgMinutes
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE o.status = 'PAID' AND r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      const conversionRows: any = (await query(
        `SELECT
          SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) AS paid,
          COUNT(*) AS total
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ? AND o.created_at >= ? AND o.created_at < ?`,
        [agencyId, monthStart, monthEnd]
      ) as any[])[0]
      const avgTicketRows: any = (await query(
        `SELECT AVG(tk.price) AS avgTicket
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      const refundRows: any = (await query(
        `SELECT
          SUM(CASE WHEN tk.status = 'REFUNDED' THEN 1 ELSE 0 END) AS refunded,
          COUNT(*) AS total
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      const advanceRows: any = (await query(
        `SELECT
          SUM(CASE WHEN TIMESTAMPDIFF(HOUR, tk.issued_at, t.departure_at) >= 24 THEN 1 ELSE 0 END) AS advanceCnt,
          COUNT(*) AS total
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      performanceMetrics = {
        avgPurchaseMinutes: Number(purchaseRows?.avgMinutes || 0),
        conversionRate: conversionRows?.total ? Number(conversionRows.paid || 0) / Number(conversionRows.total || 1) : 0,
        avgTicket: Number(avgTicketRows?.avgTicket || 0),
        refundRate: refundRows?.total ? Number(refundRows.refunded || 0) / Number(refundRows.total || 1) : 0,
        advanceBookingRate: advanceRows?.total ? Number(advanceRows.advanceCnt || 0) / Number(advanceRows.total || 1) : 0
      }
    } else {
      revenueRows = await query(
        `SELECT COALESCE(SUM(o.total_amount),0) AS revenue FROM \`Order\` o WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ?`,
        [monthStart, monthEnd]
      )
      ticketsRows = await query('SELECT COUNT(*) AS tickets FROM `Ticket`', [])
      customersRows = await query('SELECT COUNT(DISTINCT o.user_id) AS customers FROM `Order` o', [])
      monthlySeries = (await query(
        `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS ym, COALESCE(SUM(o.total_amount),0) AS revenue
         FROM \`Order\` o
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ?
         GROUP BY ym
         ORDER BY ym`,
        [seriesStart, monthEnd]
      ) as any[])
      salesDistribution = (await query(
        `SELECT COALESCE(o.payment_method, 'OTROS') AS label, COUNT(*) AS value
         FROM \`Order\` o
         GROUP BY label
         ORDER BY value DESC`
      ) as any[])
      timeSlots = (await query(
        `SELECT
          SUM(CASE WHEN HOUR(t.departure_at) >= 6 AND HOUR(t.departure_at) < 9 THEN t.seats_sold ELSE 0 END) AS s1,
          SUM(CASE WHEN HOUR(t.departure_at) >= 9 AND HOUR(t.departure_at) < 12 THEN t.seats_sold ELSE 0 END) AS s2,
          SUM(CASE WHEN HOUR(t.departure_at) >= 12 AND HOUR(t.departure_at) < 15 THEN t.seats_sold ELSE 0 END) AS s3,
          SUM(CASE WHEN HOUR(t.departure_at) >= 15 AND HOUR(t.departure_at) < 18 THEN t.seats_sold ELSE 0 END) AS s4,
          SUM(CASE WHEN HOUR(t.departure_at) >= 18 AND HOUR(t.departure_at) < 21 THEN t.seats_sold ELSE 0 END) AS s5
         FROM \`Trip\` t`,
        []
      ) as any[])
      const purchaseRows: any = (await query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avgMinutes
         FROM \`Order\` o
         WHERE o.status = 'PAID'`,
        []
      ) as any[])[0]
      const conversionRows: any = (await query(
        `SELECT
          SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) AS paid,
          COUNT(*) AS total
         FROM \`Order\` o
         WHERE o.created_at >= ? AND o.created_at < ?`,
        [monthStart, monthEnd]
      ) as any[])[0]
      const avgTicketRows: any = (await query('SELECT AVG(price) AS avgTicket FROM `Ticket`', []) as any[])[0]
      const refundRows: any = (await query(
        `SELECT
          SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) AS refunded,
          COUNT(*) AS total
         FROM \`Ticket\``
      ) as any[])[0]
      const advanceRows: any = (await query(
        `SELECT
          SUM(CASE WHEN TIMESTAMPDIFF(HOUR, tk.issued_at, t.departure_at) >= 24 THEN 1 ELSE 0 END) AS advanceCnt,
          COUNT(*) AS total
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id`,
        []
      ) as any[])[0]
      performanceMetrics = {
        avgPurchaseMinutes: Number(purchaseRows?.avgMinutes || 0),
        conversionRate: conversionRows?.total ? Number(conversionRows.paid || 0) / Number(conversionRows.total || 1) : 0,
        avgTicket: Number(avgTicketRows?.avgTicket || 0),
        refundRate: refundRows?.total ? Number(refundRows.refunded || 0) / Number(refundRows.total || 1) : 0,
        advanceBookingRate: advanceRows?.total ? Number(advanceRows.advanceCnt || 0) / Number(advanceRows.total || 1) : 0
      }
    }
    const occupancyRows: any = (await query(`SELECT COALESCE(AVG(CASE WHEN t.capacity > 0 THEN t.seats_sold / t.capacity ELSE 0 END),0) AS avgOcc FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id WHERE 1=1 ${agencyFilter}`, agencyFilter ? params.slice(2) : []) as any[])[0]

    const routesRows: any = await query(
      `SELECT r.code, r.origin, r.destination, SUM(t.seats_sold) AS sales, SUM(t.seats_sold * t.base_price) AS revenue, CASE WHEN SUM(t.capacity) > 0 THEN (SUM(t.seats_sold) / SUM(t.capacity)) * 100 ELSE 0 END AS occupancy
       FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id
       WHERE 1=1 ${agencyFilter}
       GROUP BY r.id, r.code, r.origin, r.destination
       ORDER BY sales DESC
       LIMIT 8`, agencyFilter ? params.slice(2) : [])

    const revenueData = Array.isArray(revenueRows) ? (revenueRows[0] || {}) : (revenueRows || {})
    const ticketsData = Array.isArray(ticketsRows) ? (ticketsRows[0] || {}) : (ticketsRows || {})
    const customersData = Array.isArray(customersRows) ? (customersRows[0] || {}) : (customersRows || {})

    res.json({
      monthlyRevenue: Number(revenueData?.revenue || 0),
      ticketsSold: Number(ticketsData?.tickets || 0),
      activeCustomers: Number(customersData?.customers || 0),
      averageOccupancy: Number(occupancyRows?.avgOcc || 0),
      popularRoutes: routesRows || [],
      monthlySeries: monthlySeries || [],
      salesDistribution: salesDistribution || [],
      timeSlots: timeSlots && timeSlots[0] ? timeSlots[0] : {},
      performanceMetrics
    })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/config
router.get('/config', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const rows: any = await query('SELECT config_key AS configKey, config_value AS configValue FROM `SystemConfig` WHERE scope = ? AND agency_id IS NULL', ['GLOBAL'])
    const data: any = {}
    ;(rows || []).forEach((row: any) => {
      data[row.configKey] = parseJson(row.configValue)
    })
    res.json({ config: data })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/config
router.put('/config', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const configs = req.body?.configs || null
    if (!configs || typeof configs !== 'object') return res.status(400).json({ error: 'configs object required' })

    const entries = Object.entries(configs)
    for (const [key, value] of entries) {
      await query(
        'INSERT INTO `SystemConfig` (scope, agency_id, config_key, config_value, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()',
        ['GLOBAL', null, key, JSON.stringify(value || null)]
      )
    }
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/users
router.get('/users', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const rows: any = await query(
            `SELECT u.id, u.uuid, u.email, u.name, u.phone, u.role, u.is_verified AS isVerified, u.created_at AS createdAt,
              aw.agency_id AS agencyId, aw.role AS agencyWorkerRole, aw.scanner_enabled AS scannerEnabled, a.name AS agencyName, a.phone AS agencyPhone, a.address AS agencyAddress
             FROM \`User\` u
             LEFT JOIN \`AgencyWorker\` aw ON aw.user_id = u.id
             LEFT JOIN \`Agency\` a ON a.id = aw.agency_id
             ORDER BY u.created_at DESC`
    )
    res.json({ users: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/users
router.post('/users', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { email, name, password, role, agencyId, agencyName, agencyPhone, agencyAddress } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    const validRoles = ['USER', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_WORKER', 'SCANNER']
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'invalid role' })

    const existing: any = await query('SELECT id FROM `User` WHERE email = ? LIMIT 1', [email])
    if (existing && existing[0]) return res.status(409).json({ error: 'email already exists' })

    const hash = await bcrypt.hash(password, 10)
    const uuid = crypto.randomUUID()
    const requestedRole = role || 'USER'
    const userRole = requestedRole === 'SCANNER' ? 'USER' : requestedRole
    const result: any = await query(
      'INSERT INTO `User` (uuid, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [uuid, email, hash, name || null, userRole]
    )
    const userId = result?.insertId

    if (requestedRole === 'AGENCY_ADMIN' || requestedRole === 'AGENCY_WORKER' || requestedRole === 'SCANNER') {
      let agency = agencyId
      if (!agency) {
        if (!agencyName) return res.status(400).json({ error: 'agencyName required' })
        const found: any = await query('SELECT id FROM `Agency` WHERE name = ? LIMIT 1', [agencyName])
        if (found && found[0]) {
          agency = found[0].id
        } else {
          const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
          const ins: any = await query(
            'INSERT INTO `Agency` (name, phone, address, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [agencyName, agencyPhone || null, addressJson, 'ACTIVE']
          )
          agency = ins?.insertId
        }
      }
      await query(
        'INSERT INTO `AgencyWorker` (user_id, agency_id, role, scanner_enabled, active) VALUES (?, ?, ?, ?, 1)',
        [userId, agency, mapAgencyWorkerRole(requestedRole), mapAgencyWorkerScannerEnabled(requestedRole)]
      )
    }

    res.json({ success: true, id: userId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/users/:id
router.put('/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })

    const { email, name, password, role, agencyId, agencyName, agencyPhone, agencyAddress } = req.body || {}
    const validRoles = ['USER', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_WORKER', 'SCANNER']
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'invalid role' })

    const nextDbRole = role === 'SCANNER' ? 'USER' : role

    await query(
      'UPDATE `User` SET email = COALESCE(?, email), name = COALESCE(?, name), role = COALESCE(?, role), updated_at = NOW() WHERE id = ?',
      [email || null, name || null, nextDbRole || null, id]
    )

    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await query('UPDATE `User` SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, id])
    }

    const existingAgency: any = await query(
      'SELECT aw.agency_id AS agencyId, aw.scanner_enabled AS scannerEnabled FROM `AgencyWorker` aw WHERE aw.user_id = ? LIMIT 1',
      [id]
    )
    const existingAgencyId = existingAgency && existingAgency[0] ? existingAgency[0].agencyId : null
    const existingScannerEnabled = existingAgency && existingAgency[0] ? Number(existingAgency[0].scannerEnabled || 0) : 0
    const nextRole = role

    if (nextRole === 'AGENCY_ADMIN' || nextRole === 'AGENCY_WORKER' || nextRole === 'SCANNER') {
      let agency = agencyId || existingAgencyId
      if (!agency) {
        if (!agencyName) return res.status(400).json({ error: 'agencyName required' })
        const found: any = await query('SELECT id FROM `Agency` WHERE name = ? LIMIT 1', [agencyName])
        if (found && found[0]) {
          agency = found[0].id
        } else {
          const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
          const ins: any = await query(
            'INSERT INTO `Agency` (name, phone, address, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [agencyName, agencyPhone || null, addressJson, 'ACTIVE']
          )
          agency = ins?.insertId
        }
      }

      if (existingAgencyId) {
        if (agencyName || agencyPhone || agencyAddress) {
          const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
          await query(
            'UPDATE `Agency` SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), updated_at = NOW() WHERE id = ?',
            [agencyName || null, agencyPhone || null, addressJson, agency]
          )
        }
        await query('UPDATE `AgencyWorker` SET agency_id = ?, role = ?, scanner_enabled = ? WHERE user_id = ?', [agency, mapAgencyWorkerRole(nextRole), mapAgencyWorkerScannerEnabled(nextRole), id])
      } else {
        await query(
          'INSERT INTO `AgencyWorker` (user_id, agency_id, role, scanner_enabled, active) VALUES (?, ?, ?, ?, 1)',
          [id, agency, mapAgencyWorkerRole(nextRole), mapAgencyWorkerScannerEnabled(nextRole)]
        )
      }
    } else if (nextRole) {
      if (existingAgencyId) {
        await query('DELETE FROM `AgencyWorker` WHERE user_id = ?', [id])
      }
    } else if (existingAgencyId && (agencyName || agencyPhone || agencyAddress)) {
      const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
      await query(
        'UPDATE `Agency` SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), updated_at = NOW() WHERE id = ?',
        [agencyName || null, agencyPhone || null, addressJson, existingAgencyId]
      )
      if (existingScannerEnabled) {
        await query('UPDATE `AgencyWorker` SET scanner_enabled = 1 WHERE user_id = ?', [id])
      }
    }

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/users/:id
router.delete('/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    if (Number(req.user?.userId) === id) return res.status(400).json({ error: 'cannot delete self' })

    await query('DELETE FROM `AgencyWorker` WHERE user_id = ?', [id])
    await query('DELETE FROM `User` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
