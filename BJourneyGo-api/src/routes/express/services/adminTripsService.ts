import { query, transaction } from '../../../lib/db'

export async function listTrips(agencyId?: number | null) {
  const where: string[] = []
  const params: any[] = []
  if (agencyId) {
    where.push('r.agency_id = ?')
    params.push(agencyId)
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
  return query(
    `SELECT t.id, t.route_id AS routeId, r.code AS routeCode, r.origin, r.destination, t.bus_id AS busId, DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice, t.status FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id ${clause} ORDER BY t.departure_at DESC`,
    params
  )
}

export async function getTripSchedule(id: number) {
  const rows: any = await query('SELECT departure_at AS departureAt, arrival_at AS arrivalAt FROM `Trip` WHERE id = ? LIMIT 1', [id])
  return rows && rows[0] ? rows[0] : null
}

export async function routeAllowedForAgency(routeId: number, agencyId: number) {
  const rows: any = await query('SELECT id FROM `Route` WHERE id = ? AND agency_id = ? LIMIT 1', [routeId, agencyId])
  return rows && rows.length > 0
}

export async function routesAllowedForAgency(routeIds: number[], agencyId: number) {
  const uniqueIds = Array.from(new Set(routeIds.filter((id) => Number(id) > 0)))
  if (uniqueIds.length === 0) return true
  const placeholders = uniqueIds.map(() => '?').join(',')
  const rows: any = await query(
    `SELECT id FROM \`Route\` WHERE id IN (${placeholders}) AND agency_id = ?`,
    [...uniqueIds, agencyId]
  )
  const allowedSet = new Set((rows || []).map((r: any) => Number(r.id)))
  return uniqueIds.every((id) => allowedSet.has(Number(id)))
}

export async function busesAllowedForAgency(busIds: number[], agencyId: number) {
  const uniqueIds = Array.from(new Set(busIds.filter((id) => Number(id) > 0)))
  if (uniqueIds.length === 0) return true
  const placeholders = uniqueIds.map(() => '?').join(',')
  const rows: any = await query(
    `SELECT id FROM \`Bus\` WHERE id IN (${placeholders}) AND agency_id = ?`,
    [...uniqueIds, agencyId]
  )
  const allowedSet = new Set((rows || []).map((b: any) => Number(b.id)))
  return uniqueIds.every((id) => allowedSet.has(Number(id)))
}

export async function createTrip(input: {
  routeId: number
  busId?: number | null
  departureAt: string
  arrivalAt: string
  capacity: number
  basePrice: number
  status: string
}) {
  const { routeId, busId, departureAt, arrivalAt, capacity, basePrice, status } = input
  const result: any = await query(
    'INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [routeId, busId || null, departureAt, arrivalAt, capacity, basePrice, status]
  )
  return result?.insertId
}

export async function createRoundTrip(input: {
  outbound: {
    routeId: number
    busId?: number | null
    departureAt: string
    arrivalAt: string
    capacity: number
    basePrice: number
    status: string
  }
  returnTrip: {
    routeId: number
    busId?: number | null
    departureAt: string
    arrivalAt: string
    capacity: number
    basePrice: number
    status: string
  }
}) {
  return transaction(async (tx: any) => {
    const [outboundIns]: any = await tx.query(
      'INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        input.outbound.routeId,
        input.outbound.busId || null,
        input.outbound.departureAt,
        input.outbound.arrivalAt,
        input.outbound.capacity,
        input.outbound.basePrice,
        input.outbound.status,
      ]
    )

    const [returnIns]: any = await tx.query(
      'INSERT INTO `Trip` (route_id, bus_id, departure_at, arrival_at, capacity, base_price, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        input.returnTrip.routeId,
        input.returnTrip.busId || null,
        input.returnTrip.departureAt,
        input.returnTrip.arrivalAt,
        input.returnTrip.capacity,
        input.returnTrip.basePrice,
        input.returnTrip.status,
      ]
    )

    return {
      outboundTripId: outboundIns?.insertId,
      returnTripId: returnIns?.insertId,
    }
  })
}

export async function updateTrip(input: {
  id: number
  departureAt?: string | null
  arrivalAt?: string | null
  capacity?: number | null
  basePrice?: number | null
  status?: string | null
}) {
  const { id, departureAt, arrivalAt, capacity, basePrice, status } = input
  await query(
    'UPDATE `Trip` SET departure_at = COALESCE(?, departure_at), arrival_at = COALESCE(?, arrival_at), capacity = COALESCE(?, capacity), base_price = COALESCE(?, base_price), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?',
    [departureAt || null, arrivalAt || null, capacity, basePrice, status || null, id]
  )
}

export async function deleteTrip(id: number) {
  await query('DELETE FROM `Trip` WHERE id = ?', [id])
}
