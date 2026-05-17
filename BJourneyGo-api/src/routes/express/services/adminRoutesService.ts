import { query } from '../../../lib/db'

export async function listRoutes(agencyId?: number | null) {
  if (agencyId) {
    return query(
      'SELECT id, code, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status, agency_id AS agencyId FROM `Route` WHERE agency_id = ? ORDER BY origin, destination',
      [agencyId]
    )
  }

  return query(
    'SELECT id, code, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status, agency_id AS agencyId FROM `Route` ORDER BY origin, destination'
  )
}

export async function createRoute(input: {
  code: string
  origin: string
  destination: string
  distanceKm?: any
  durationMinutes?: any
  status?: string
  agencyId?: number | null
}) {
  const { code, origin, destination, distanceKm, durationMinutes, status, agencyId } = input
  const result: any = await query(
    'INSERT INTO `Route` (code, agency_id, origin, destination, distance_km, duration_minutes, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [code, agencyId || null, origin, destination, distanceKm || null, durationMinutes || null, status || 'ACTIVE']
  )
  return result?.insertId
}

export async function updateRoute(input: {
  id: number
  code?: any
  origin?: any
  destination?: any
  distanceKm?: any
  durationMinutes?: any
  status?: any
  basePrice?: number
}) {
  const { id, code, origin, destination, distanceKm, durationMinutes, status, basePrice } = input
  await query(
    'UPDATE `Route` SET code = COALESCE(?, code), origin = COALESCE(?, origin), destination = COALESCE(?, destination), distance_km = COALESCE(?, distance_km), duration_minutes = COALESCE(?, duration_minutes), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?',
    [code || null, origin || null, destination || null, distanceKm || null, durationMinutes || null, status || null, id]
  )

  if (basePrice !== undefined) {
    await query('UPDATE `Trip` SET base_price = ?, updated_at = NOW() WHERE route_id = ?', [basePrice, id])
  }
}

export async function deleteRoute(id: number) {
  await query('DELETE FROM `Route` WHERE id = ?', [id])
}
