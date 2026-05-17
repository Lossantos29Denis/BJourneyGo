import { query } from '../../../lib/db'

export async function listShifts(input: {
  startDate?: Date | null
  endDate?: Date | null
  agencyId?: number | null
}) {
  const { startDate, endDate, agencyId } = input
  const where: string[] = []
  const params: any[] = []
  if (startDate && endDate) {
    where.push('s.shift_date >= ? AND s.shift_date < ?')
    params.push(startDate, endDate)
  }
  if (agencyId) {
    where.push('s.agency_id = ?')
    params.push(agencyId)
  }

  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
  return query(
    `SELECT s.id, s.user_id AS userId, s.agency_id AS agencyId, s.shift_date AS shiftDate, s.shift_type AS shiftType, s.notes,
            u.name AS userName, u.email AS userEmail, u.role AS userRole
     FROM \`Shift\` s
     JOIN \`User\` u ON u.id = s.user_id
     ${clause}
     ORDER BY s.shift_date ASC`,
    params
  )
}

export async function createShift(input: {
  userId: number
  agencyId?: number | null
  shiftDate: any
  shiftType: any
  notes?: any
}) {
  const { userId, agencyId, shiftDate, shiftType, notes } = input
  const result: any = await query(
    'INSERT INTO `Shift` (user_id, agency_id, shift_date, shift_type, notes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
    [userId, agencyId || null, shiftDate, shiftType, notes || null]
  )
  return result?.insertId
}

export async function shiftBelongsToAgency(id: number, agencyId: number) {
  const rows: any = await query('SELECT id FROM `Shift` WHERE id = ? AND agency_id = ? LIMIT 1', [id, agencyId])
  return rows && rows.length > 0
}

export async function updateShift(input: {
  id: number
  shiftDate?: any
  shiftType?: any
  notes?: any
}) {
  const { id, shiftDate, shiftType, notes } = input
  await query(
    'UPDATE `Shift` SET shift_date = COALESCE(?, shift_date), shift_type = COALESCE(?, shift_type), notes = COALESCE(?, notes), updated_at = NOW() WHERE id = ?',
    [shiftDate || null, shiftType || null, notes || null, id]
  )
}

export async function deleteShift(id: number) {
  await query('DELETE FROM `Shift` WHERE id = ?', [id])
}

export async function listCalendarEvents(input: {
  userId: number
  startDate?: Date | null
  endDate?: Date | null
}) {
  const { userId, startDate, endDate } = input
  const where: string[] = ['e.user_id = ?']
  const params: any[] = [userId]
  if (startDate && endDate) {
    where.push('e.start_at >= ? AND e.start_at < ?')
    params.push(startDate, endDate)
  }

  return query(
    `SELECT e.id, e.user_id AS userId, e.agency_id AS agencyId, e.event_type AS eventType, e.title,
            e.start_at AS startAt, e.end_at AS endAt, e.details, e.created_at AS createdAt, e.updated_at AS updatedAt
     FROM \`CalendarEvent\` e
     WHERE ${where.join(' AND ')}
     ORDER BY e.start_at ASC`,
    params
  )
}

export async function createCalendarEvent(input: {
  userId: number
  agencyId?: number | null
  title: string
  startAt: any
  endAt?: any
  details?: any
}) {
  const { userId, agencyId, title, startAt, endAt, details } = input
  const result: any = await query(
    'INSERT INTO `CalendarEvent` (user_id, agency_id, event_type, title, start_at, end_at, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [userId, agencyId || null, 'APPOINTMENT', title, startAt, endAt || null, details ? JSON.stringify(details) : null]
  )
  return result?.insertId
}

export async function calendarEventOwnedByUser(id: number, userId: number) {
  const rows: any = await query('SELECT id FROM `CalendarEvent` WHERE id = ? AND user_id = ? LIMIT 1', [id, userId])
  return rows && rows.length > 0
}

export async function updateCalendarEvent(input: {
  id: number
  title?: any
  startAt?: any
  endAt?: any
  details?: any
}) {
  const { id, title, startAt, endAt, details } = input
  await query(
    'UPDATE `CalendarEvent` SET title = COALESCE(?, title), start_at = COALESCE(?, start_at), end_at = COALESCE(?, end_at), details = COALESCE(?, details), updated_at = NOW() WHERE id = ?',
    [title || null, startAt || null, endAt || null, details ? JSON.stringify(details) : null, id]
  )
}

export async function deleteCalendarEvent(id: number) {
  await query('DELETE FROM `CalendarEvent` WHERE id = ?', [id])
}
