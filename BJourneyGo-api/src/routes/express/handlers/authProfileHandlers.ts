import bcrypt from 'bcryptjs'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { query } from '../../../lib/db'
import authenticate from '../../../server/middleware'
import { JWT_SECRET, resolveEffectiveAuthContext } from '../utils/authUtils'

export function registerAuthProfileHandlers(router: Router) {
  router.get('/me', authenticate, async (req: any, res) => {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'unauthorized' })
    const token = auth.replace('Bearer ', '')
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const rows: any = await query(
        'SELECT u.id, u.uuid, u.email, u.name, u.phone, u.phone_country AS phoneCountry, u.role, u.is_verified AS isVerified, u.created_at AS createdAt, u.updated_at AS updatedAt, aw.scanner_enabled AS scannerEnabled, aw.agency_id AS agencyId, a.name AS agencyName FROM `User` u LEFT JOIN `AgencyWorker` aw ON aw.user_id = u.id LEFT JOIN `Agency` a ON a.id = aw.agency_id WHERE u.id = ? LIMIT 1',
        [payload.userId]
      )
      const dbUser = rows && rows[0]
      if (!dbUser) return res.status(404).json({ error: 'not found' })
      const authCtx = await resolveEffectiveAuthContext(Number(dbUser.id), String(dbUser.role || 'USER'))
      const role = authCtx.tokenRole === 'USER' && authCtx.hasScannerPermission ? 'SCANNER' : authCtx.tokenRole
      res.json({ user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, phone: dbUser.phone, phoneCountry: dbUser.phoneCountry, role, isVerified: dbUser.isVerified, scannerEnabled: authCtx.hasScannerPermission, agencyId: authCtx.agencyId, agencyName: authCtx.agencyName } })
    } catch (e: any) {
      res.status(401).json({ error: 'invalid token' })
    }
  })

  router.put('/me', authenticate, async (req: any, res) => {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'unauthorized' })
    const token = auth.replace('Bearer ', '')
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const { name, phone, phoneCountry } = req.body || {}
      if (!name && !phone && !phoneCountry) return res.status(400).json({ error: 'no changes provided' })
      await query('UPDATE `User` SET name = COALESCE(?, name), phone = COALESCE(?, phone), phone_country = COALESCE(?, phone_country), updated_at = NOW() WHERE id = ?', [name || null, phone || null, phoneCountry || null, payload.userId])
      const rows: any = await query('SELECT id, uuid, email, name, phone, phone_country AS phoneCountry, role, is_verified AS isVerified FROM `User` WHERE id = ? LIMIT 1', [payload.userId])
      const dbUser = rows && rows[0]
      res.json({ success: true, user: { id: dbUser.id, email: dbUser.email, name: dbUser.name, role: dbUser.role, phone: dbUser.phone, phoneCountry: dbUser.phoneCountry } })
    } catch (e: any) {
      res.status(401).json({ error: 'invalid token' })
    }
  })

  router.post('/me/change-password', authenticate, async (req: any, res) => {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'unauthorized' })
    const token = auth.replace('Bearer ', '')
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const { currentPassword, newPassword } = req.body || {}
      if (!currentPassword || !newPassword) return res.status(400).json({ error: 'currentPassword and newPassword required' })
      const rows: any = await query('SELECT id, password_hash AS passwordHash FROM `User` WHERE id = ? LIMIT 1', [payload.userId])
      const user = rows && rows[0]
      if (!user) return res.status(404).json({ error: 'user not found' })
      const ok = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!ok) return res.status(400).json({ error: 'invalid current password' })
      const hash = await bcrypt.hash(newPassword, 10)
      await query('UPDATE `User` SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, payload.userId])
      res.json({ success: true })
    } catch (e: any) {
      res.status(401).json({ error: 'invalid token' })
    }
  })

  router.delete('/me', authenticate, async (req: any, res) => {
    const auth = req.headers.authorization
    if (!auth) return res.status(401).json({ error: 'unauthorized' })
    const token = auth.replace('Bearer ', '')
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const { currentPassword } = req.body || {}
      if (!currentPassword) return res.status(400).json({ error: 'currentPassword required' })
      const rows: any = await query('SELECT id, password_hash AS passwordHash FROM `User` WHERE id = ? LIMIT 1', [payload.userId])
      const user = rows && rows[0]
      if (!user) return res.status(404).json({ error: 'user not found' })
      const ok = await bcrypt.compare(currentPassword, user.passwordHash)
      if (!ok) return res.status(400).json({ error: 'invalid current password' })

      await query('DELETE FROM `RefreshToken` WHERE user_id = ?', [payload.userId])
      await query('DELETE FROM `User` WHERE id = ?', [payload.userId])

      res.json({ success: true })
    } catch (e: any) {
      res.status(401).json({ error: 'invalid token' })
    }
  })
}