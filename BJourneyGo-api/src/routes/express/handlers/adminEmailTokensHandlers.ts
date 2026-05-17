import { Router } from 'express'
import { query } from '../../../lib/db'
import { authenticate } from '../../../server/middleware'

export function registerAdminEmailTokensHandlers(router: Router) {
  router.get('/', authenticate, async (req: any, res) => {
    const payload = req.user
    if (payload?.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
    const q = req.query || {}
    const limit = Math.min(Number(q.limit) || 50, 500)
    const offset = Number(q.offset) || 0
    try {
      const tokens: any = await query('SELECT id, jti, user_id AS userId, purpose, expires_at AS expiresAt, used, used_at AS usedAt, revoked, created_at AS createdAt FROM `EmailToken` ORDER BY created_at DESC LIMIT ? OFFSET ?', [limit, offset])
      res.json({ tokens })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/:jti', authenticate, async (req: any, res) => {
    const payload = req.user
    if (payload?.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
    const jti = req.params.jti
    try {
      const rows: any = await query('SELECT id, jti, user_id AS userId, purpose, expires_at AS expiresAt, used, used_at AS usedAt, revoked, created_at AS createdAt FROM `EmailToken` WHERE jti = ? LIMIT 1', [jti])
      const token = rows && rows[0]
      if (!token) return res.status(404).json({ error: 'not found' })
      res.json({ token })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.post('/revoke', authenticate, async (req: any, res) => {
    const payload = req.user
    if (payload?.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
    const { jti } = req.body || {}
    if (!jti) return res.status(400).json({ error: 'jti required' })
    try {
      const rows: any = await query('SELECT id, jti, user_id AS userId, purpose, expires_at AS expiresAt, used, used_at AS usedAt, revoked, created_at AS createdAt FROM `EmailToken` WHERE jti = ? LIMIT 1', [jti])
      const token = rows && rows[0]
      if (!token) return res.status(404).json({ error: 'not found' })
      await query('UPDATE `EmailToken` SET revoked = ? WHERE jti = ?', [true, jti])
      res.json({ ok: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/verification-logs', authenticate, async (req: any, res) => {
    const payload = req.user
    if (payload?.role !== 'ADMIN') return res.status(403).json({ error: 'forbidden' })
    const q = req.query || {}
    const limit = Math.min(Number(q.limit) || 50, 500)
    const offset = Number(q.offset) || 0
    try {
      const rows: any = await query(
        'SELECT l.id, l.user_id AS userId, l.email, l.token_jti AS tokenJti, l.verified_at AS verifiedAt, l.ip_address AS ipAddress, l.user_agent AS userAgent, l.created_at AS createdAt '
        + 'FROM `EmailVerificationLog` l '
        + 'ORDER BY l.created_at DESC '
        + 'LIMIT ? OFFSET ?',
        [limit, offset]
      )
      res.json({ logs: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
