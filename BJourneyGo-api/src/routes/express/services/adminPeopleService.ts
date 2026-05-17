import { query } from '../../../lib/db'

export async function listBuses(agencyId?: number | null) {
  if (agencyId) {
    return query('SELECT id, plate, agency_id AS agencyId, capacity FROM `Bus` WHERE agency_id = ? ORDER BY id', [agencyId])
  }
  return query('SELECT id, plate, agency_id AS agencyId, capacity FROM `Bus` ORDER BY id')
}

export async function listShiftUsers(agencyId?: number | null) {
  if (agencyId) {
    return query(
      `SELECT u.id, u.name, u.email, u.role, aw.agency_id AS agencyId
       FROM \`User\` u
       JOIN \`AgencyWorker\` aw ON aw.user_id = u.id
       WHERE aw.agency_id = ? AND aw.active = 1
       ORDER BY u.name`,
      [agencyId]
    )
  }
  return query('SELECT id, name, email, role FROM `User` ORDER BY name')
}
