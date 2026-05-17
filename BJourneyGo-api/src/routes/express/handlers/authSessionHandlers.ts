import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../../../lib/db'
import { JWT_SECRET, MAIL_DISABLED, REFRESH_TOKEN_TTL_SECONDS, resolveEffectiveAuthContext } from '../utils/authUtils'

export function registerAuthSessionHandlers(router: Router) {
  router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' })
    try {
      const payload: any = jwt.verify(refreshToken, JWT_SECRET)
      const jti = payload?.jti
      if (!jti) return res.status(400).json({ error: 'invalid token' })
      const rows: any = await query('SELECT id, jti, user_id AS userId, expires_at AS expiresAt, revoked FROM `RefreshToken` WHERE jti = ? LIMIT 1', [jti])
      const rec = rows && rows[0]
      if (!rec) return res.status(400).json({ error: 'refresh token not found' })
      if (rec.revoked) return res.status(400).json({ error: 'refresh token revoked' })
      if (new Date() > new Date(rec.expiresAt)) return res.status(400).json({ error: 'refresh token expired' })

      const userRows: any = await query('SELECT id, role FROM `User` WHERE id = ? LIMIT 1', [rec.userId])
      const user = userRows && userRows[0]
      if (!user) return res.status(400).json({ error: 'user not found' })

      const authCtx = await resolveEffectiveAuthContext(Number(user.id), String(user.role || 'USER'))

      const accessJti = crypto.randomUUID()
      const token = jwt.sign({ userId: user.id, role: authCtx.tokenRole, jti: accessJti }, JWT_SECRET, { expiresIn: '15m' })
      res.json({ success: true, token })
    } catch (e: any) {
      res.status(400).json({ error: String(e.message || e) })
    }
  })

  router.post('/logout', async (req, res) => {
    const { refreshToken } = req.body || {}
    if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' })
    try {
      const payload: any = jwt.verify(refreshToken, JWT_SECRET)
      const jti = payload?.jti
      if (!jti) return res.status(400).json({ error: 'invalid token' })
      await query('UPDATE `RefreshToken` SET revoked = 1 WHERE jti = ?', [jti])

      const auth = req.headers.authorization
      if (auth) {
        try {
          const access = auth.replace('Bearer ', '')
          const payloadA: any = jwt.verify(access, JWT_SECRET)
          const accessJti = payloadA?.jti
          const exp = payloadA?.exp ? new Date(payloadA.exp * 1000) : new Date(Date.now() + 15 * 60 * 1000)
          if (accessJti) {
            await query('INSERT INTO `AccessTokenBlacklist` (jti, expires_at, created_at) VALUES (?, ?, NOW())', [accessJti, exp])
          }
        } catch (e) {
          // ignore
        }
      }

      res.json({ success: true })
    } catch (e: any) {
      res.status(400).json({ error: String(e.message || e) })
    }
  })

  router.post('/login', async (req, res) => {
    const { identity, email, password } = req.body as any
    const loginIdentity = String(identity || email || '').trim()
    if (!loginIdentity || !password) return res.status(400).json({ error: 'email/identity and password required' })
    try {
      const rows: any = await query(
        'SELECT id, uuid, email, password_hash AS passwordHash, name, phone, role, is_verified AS isVerified, created_at AS createdAt, updated_at AS updatedAt FROM `User` WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?) LIMIT 1',
        [loginIdentity, loginIdentity]
      )
      const user = rows && rows[0]
      if (!user) return res.status(401).json({ error: 'invalid credentials' })
      const ok = await bcrypt.compare(password, user.passwordHash)
      if (!ok) return res.status(401).json({ error: 'invalid credentials' })
      if (!user.isVerified && user.role !== 'ADMIN' && !MAIL_DISABLED) {
        return res.status(403).json({ error: 'email not verified' })
      }

      const authCtx = await resolveEffectiveAuthContext(Number(user.id), String(user.role || 'USER'))

      const token = jwt.sign({ userId: user.id, role: authCtx.tokenRole }, JWT_SECRET, { expiresIn: '15m' })

      const refreshJti = crypto.randomUUID()
      const refreshExpiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
      await query(
        'INSERT INTO `RefreshToken` (jti, user_id, expires_at, revoked, created_at) VALUES (?, ?, ?, 0, NOW())',
        [refreshJti, user.id, refreshExpiresAt]
      )
      const refreshToken = jwt.sign({ jti: refreshJti }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL_SECONDS })

      res.json({ success: true, token, refreshToken, role: authCtx.responseRole, isAdmin: authCtx.isAdmin, user: user.name || user.email, email: user.email, agencyId: authCtx.agencyId, agencyName: authCtx.agencyName, scannerEnabled: authCtx.hasScannerPermission })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}