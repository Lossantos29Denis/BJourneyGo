import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../lib/db'

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'

export interface AuthPayload {
  userId: number
  role?: string
  isVerified?: boolean
}

export const authenticate = async (req: Request & { user?: AuthPayload }, res: Response, next: NextFunction) => {
  const auth = req.headers.authorization
  if (!auth) return res.status(401).json({ error: 'unauthorized' })
  const token = auth.replace('Bearer ', '')
  try {
    const payload = jwt.verify(token, JWT_SECRET) as any
    const jti = payload?.jti
    if (jti) {
      try {
        const rows: any = await query('SELECT id FROM `AccessTokenBlacklist` WHERE jti = ? LIMIT 1', [jti])
        if (rows && rows.length > 0) return res.status(401).json({ error: 'token revoked' })
      } catch (e) {
        return res.status(401).json({ error: 'invalid token' })
      }
    }
    const rows: any = await query('SELECT id, role, is_verified AS isVerified FROM `User` WHERE id = ? LIMIT 1', [payload.userId])
    const dbUser = rows && rows[0]
    if (!dbUser) return res.status(401).json({ error: 'user not found' })

    const awRows: any = await query('SELECT role, scanner_enabled AS scannerEnabled, active FROM `AgencyWorker` WHERE user_id = ? LIMIT 1', [payload.userId])
    const aw = awRows && awRows[0]
    const awActive = Number(aw?.active || 0) === 1
    const awRole = String(aw?.role || '')
    const hasScannerPermission = awActive && Boolean(aw?.scannerEnabled)

    const dbRole = String(dbUser.role || 'USER')
    const effectiveRole = dbRole === 'ADMIN'
      ? 'ADMIN'
      : dbRole === 'AGENCY_ADMIN' || (dbRole === 'USER' && awActive && awRole === 'MANAGER' && !hasScannerPermission)
        ? 'AGENCY_ADMIN'
        : dbRole === 'AGENCY_WORKER' || (dbRole === 'USER' && awActive && awRole === 'STAFF' && !hasScannerPermission)
          ? 'AGENCY_WORKER'
          : 'USER'

    const allowUnverified = req.originalUrl.startsWith('/auth/resend-verify')
    if (!dbUser.isVerified && dbUser.role !== 'ADMIN' && !allowUnverified) {
      return res.status(403).json({ error: 'email not verified' })
    }

    req.user = { ...payload, role: effectiveRole, isVerified: dbUser.isVerified }
    return next()
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' })
  }
}

export default authenticate
