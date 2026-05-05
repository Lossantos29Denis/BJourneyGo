import { Router } from 'express'
import { query } from '../../lib/db'
import { authenticate } from '../../server/middleware'

const router = Router()

router.post('/routes', authenticate, async (req: any, res) => {
  const { code, origin, destination, distanceKm, durationMinutes } = req.body || {}
  if (!code || !origin || !destination) return res.status(400).json({ error: 'code, origin and destination required' })
  const payload = req.user
  const role = payload?.role
  const userId = payload?.userId
  if (!(role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER' || role === 'ADMIN')) return res.status(403).json({ error: 'forbidden' })

  try {
    const awRows: any = await query('SELECT id, user_id AS userId, agency_id AS agencyId, role, active FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [userId])
    const aw = awRows && awRows[0]
    if (!aw && role !== 'ADMIN') return res.status(403).json({ error: 'user is not associated with an agency' })
    const agencyId = aw?.agencyId || null
    const ins: any = await query('INSERT INTO `Route` (code, origin, destination, distance_km, duration_minutes, agency_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', [code, origin, destination, distanceKm ? Number(distanceKm) : null, durationMinutes ? Number(durationMinutes) : null, agencyId])
    const routeId = ins.insertId
    const row: any = await query('SELECT id, code, agency_id AS agencyId, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status, created_at AS createdAt, updated_at AS updatedAt FROM `Route` WHERE id = ? LIMIT 1', [routeId])
    res.json({ route: row && row[0] })
  } catch (e: any) {
    res.status(400).json({ error: String(e) })
  }
})

router.post('/trips', authenticate, async (req: any, res) => {
  const { routeId, busId, departureAt, arrivalAt, capacity, basePrice } = req.body || {}
  if (!routeId || !busId || !departureAt || !arrivalAt) return res.status(400).json({ error: 'routeId, busId, departureAt and arrivalAt required' })
  const payload = req.user
  const role = payload?.role
  const userId = payload?.userId
  if (!(role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER' || role === 'ADMIN')) return res.status(403).json({ error: 'forbidden' })

  try {
    const awRows: any = await query('SELECT id, user_id AS userId, agency_id AS agencyId, role, active FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [userId])
    const aw = awRows && awRows[0]
    if (!aw && role !== 'ADMIN') return res.status(403).json({ error: 'user is not associated with an agency' })
    const agencyId = aw?.agencyId || null

    const routeRows: any = await query('SELECT id, code, agency_id AS agencyId, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status, created_at AS createdAt, updated_at AS updatedAt FROM `Route` WHERE id = ? LIMIT 1', [routeId])
    const route = routeRows && routeRows[0]
    if (!route) return res.status(404).json({ error: 'route not found' })
    if (role !== 'ADMIN' && route.agencyId !== agencyId) return res.status(403).json({ error: 'route does not belong to your agency' })

    const busRows: any = await query('SELECT id, agency_id AS agencyId, plate, capacity, metadata, created_at AS createdAt, updated_at AS updatedAt FROM `Bus` WHERE id = ? LIMIT 1', [busId])
    const bus = busRows && busRows[0]
    if (!bus) return res.status(404).json({ error: 'bus not found' })
    if (role !== 'ADMIN' && bus.agencyId !== agencyId) return res.status(403).json({ error: 'bus does not belong to your agency' })

    const ins: any = await query('INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())', [Number(routeId), Number(busId), new Date(departureAt), new Date(arrivalAt), Number(capacity || bus.capacity), basePrice ? Number(basePrice) : 0])
    const tripId = ins.insertId
    const row: any = await query('SELECT id, route_id AS routeId, bus_id AS busId, DATE_FORMAT(departure_at, \'%Y-%m-%d %H:%i:%s\') AS departureAt, DATE_FORMAT(arrival_at, \'%Y-%m-%d %H:%i:%s\') AS arrivalAt, status, capacity, seats_sold AS seatsSold, base_price AS basePrice, created_at AS createdAt, updated_at AS updatedAt FROM `Trip` WHERE id = ? LIMIT 1', [tripId])
    res.json({ trip: row && row[0] })
  } catch (e: any) {
    res.status(400).json({ error: String(e) })
  }
})

export default router
