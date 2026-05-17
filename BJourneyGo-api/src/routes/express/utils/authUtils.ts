import { query } from '../../../lib/db'

export const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'
export const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7)
export const MAIL_DISABLED = String(process.env.MAIL_DISABLED || 'false').toLowerCase() === 'true'
export const RESEND_MIN_SECONDS = Number(process.env.VERIFY_RESEND_MIN_SECONDS || 60)
export const RESEND_MAX_PER_HOUR = Number(process.env.VERIFY_RESEND_MAX_PER_HOUR || 3)

export async function resolveEffectiveAuthContext(userId: number, dbRole: string) {
  const awRows: any = await query(
    'SELECT aw.id, aw.user_id AS userId, aw.agency_id AS agencyId, aw.role, aw.scanner_enabled AS scannerEnabled, aw.active, a.name AS agencyName FROM AgencyWorker aw LEFT JOIN Agency a ON aw.agency_id = a.id WHERE aw.user_id = ? LIMIT 1',
    [userId]
  )
  const agencyWorker = awRows && awRows[0]

  const awActive = Number(agencyWorker?.active || 0) === 1
  const awRole = String(agencyWorker?.role || '')
  const hasScannerPermission = awActive && Boolean(agencyWorker?.scannerEnabled)

  const isAdmin = dbRole === 'ADMIN'
  const isAgencyAdmin = dbRole === 'AGENCY_ADMIN' || (dbRole === 'USER' && awActive && awRole === 'MANAGER' && !hasScannerPermission)
  const isAgencyWorker = dbRole === 'AGENCY_WORKER' || (dbRole === 'USER' && awActive && awRole === 'STAFF' && !hasScannerPermission)

  const tokenRole = isAdmin ? 'ADMIN' : isAgencyAdmin ? 'AGENCY_ADMIN' : isAgencyWorker ? 'AGENCY_WORKER' : 'USER'
  const responseRole = isAdmin ? 'admin' : (isAgencyAdmin || isAgencyWorker) ? 'agency' : hasScannerPermission ? 'scanner' : 'user'

  return {
    tokenRole,
    responseRole,
    isAdmin,
    hasScannerPermission,
    agencyId: agencyWorker?.agencyId || null,
    agencyName: agencyWorker?.agencyName || null,
  }
}

export function buildVerifyLink(token: string) {
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`
  const webUrl = process.env.WEB_URL
  return webUrl
    ? `${webUrl.replace(/\/$/, '')}/verify?token=${token}`
    : `${apiUrl}/auth/verify?token=${token}`
}

export async function checkResendLimit(userId: number) {
  const recentRows: any = await query(
    'SELECT created_at AS createdAt FROM `EmailToken` WHERE user_id = ? AND purpose = ? ORDER BY created_at DESC LIMIT 1',
    [userId, 'VERIFY_EMAIL']
  )
  const last = recentRows && recentRows[0] ? new Date(recentRows[0].createdAt) : null
  if (last) {
    const secondsSince = (Date.now() - last.getTime()) / 1000
    if (secondsSince < RESEND_MIN_SECONDS) {
      return { ok: false, reason: 'too_soon', retryAfter: Math.ceil(RESEND_MIN_SECONDS - secondsSince) }
    }
  }

  const hourRows: any = await query(
    'SELECT COUNT(*) AS total FROM `EmailToken` WHERE user_id = ? AND purpose = ? AND created_at >= (NOW() - INTERVAL 1 HOUR)',
    [userId, 'VERIFY_EMAIL']
  )
  const count = hourRows && hourRows[0] ? Number(hourRows[0].total || 0) : 0
  if (count >= RESEND_MAX_PER_HOUR) {
    return { ok: false, reason: 'rate_limited', retryAfter: 3600 }
  }
  return { ok: true }
}