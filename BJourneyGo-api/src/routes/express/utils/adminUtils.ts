import jwt from 'jsonwebtoken'
import { query } from '../../../lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'

export function isAdmin(role?: string) {
  return role === 'ADMIN'
}

export function isAgency(role?: string) {
  return role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER'
}

export function mapAgencyWorkerRole(role?: string) {
  if (role === 'SCANNER') return 'STAFF'
  return role === 'AGENCY_ADMIN' ? 'MANAGER' : 'STAFF'
}

export function mapAgencyWorkerScannerEnabled(role?: string) {
  return role === 'SCANNER' ? 1 : 0
}

export function requireAuth(req: any, res: any, next: any) {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'unauthorized' })
  const token = auth.replace('Bearer ', '')
  try {
    const payload: any = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch (_e) {
    return res.status(401).json({ error: 'invalid token' })
  }
}

export function requireAdmin(req: any, res: any, next: any) {
  if (!isAdmin(req.user?.role)) {
    if (isAgency(req.user?.role)) return res.status(403).json({ error: 'forbidden: admin only' })
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

export function requireAdminOrAgency(req: any, res: any, next: any) {
  if (!isAdmin(req.user?.role) && !isAgency(req.user?.role)) {
    return res.status(403).json({ error: 'forbidden' })
  }
  next()
}

export async function getAgencyId(userId: number) {
  const rows: any = await query('SELECT agency_id AS agencyId FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [userId])
  return rows && rows[0] ? rows[0].agencyId : null
}

export async function getUserAgencyId(userId: number) {
  const rows: any = await query('SELECT agency_id AS agencyId FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [userId])
  return rows && rows[0] ? rows[0].agencyId : null
}

export function serializeAddress(address: any) {
  if (!address) return null
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address)
      return JSON.stringify(parsed)
    } catch (_e) {
      return JSON.stringify({ line1: address })
    }
  }
  return JSON.stringify(address)
}

export function normalizeCommissionPercent(value: any, fallback: number | null) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0 || parsed > 100) return null
  return parsed
}

export function parseDateTimeInput(value: any) {
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

export function toSqlDateTime(value: Date) {
  const yyyy = value.getFullYear()
  const mm = String(value.getMonth() + 1).padStart(2, '0')
  const dd = String(value.getDate()).padStart(2, '0')
  const hh = String(value.getHours()).padStart(2, '0')
  const mi = String(value.getMinutes()).padStart(2, '0')
  const ss = String(value.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

export function parseJson(value: any) {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch (_e) {
    return null
  }
}
