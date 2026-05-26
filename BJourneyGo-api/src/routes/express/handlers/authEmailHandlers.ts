import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Router } from 'express'
import jwt from 'jsonwebtoken'
import { query, transaction } from '../../../lib/db'
import { buildResetEmail, buildVerifyEmail } from '../../../lib/emailTemplates'
import mailer from '../../../lib/mailer'
import authenticate from '../../../server/middleware'
import { buildVerifyLink, checkResendLimit, JWT_SECRET, MAIL_DISABLED } from '../utils/authUtils'

export function registerAuthEmailHandlers(router: Router) {
  router.post('/register', async (req, res) => {
    const { email, password, name } = req.body as any
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    try {
      const existing: any = await query(
        'SELECT id, uuid, email, password_hash AS passwordHash, name, phone, role, is_verified AS isVerified, created_at AS createdAt, updated_at AS updatedAt FROM `User` WHERE email = ? LIMIT 1',
        [email]
      )
      if (existing && existing[0]) return res.status(409).json({ error: 'email already exists' })

      const hash = await bcrypt.hash(password, 10)
      const uuid = crypto.randomUUID()
      const ins: any = await query('INSERT INTO `User` (uuid, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())', [uuid, email, hash, name])
      const insertId = ins && ins.insertId
      const userRows: any = await query(
        'SELECT id, uuid, email, password_hash AS passwordHash, name, phone, role, is_verified AS isVerified, created_at AS createdAt, updated_at AS updatedAt FROM `User` WHERE id = ? LIMIT 1',
        [insertId]
      )
      const user = userRows && userRows[0]

      try {
        const jti = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
        await query('INSERT INTO `EmailToken` (jti, user_id, purpose, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, false, NOW())', [jti, user.id, 'VERIFY_EMAIL', expiresAt])
        const verifyToken = jwt.sign({ jti, purpose: 'VERIFY_EMAIL' }, JWT_SECRET, { expiresIn: '24h' })
        const verifyLink = buildVerifyLink(verifyToken)
        if (!MAIL_DISABLED) {
          const tmpl = buildVerifyEmail(verifyLink)
          try {
            await mailer.sendMail({ to: user.email, subject: tmpl.subject, text: tmpl.text, html: tmpl.html })
          } catch (e: any) {
            console.warn('Failed to send verification email', { email: user.email, error: e?.message || e })
          }
        }

        res.json({
          success: true,
          verificationRequired: true,
          verificationId: jti,
          email: user.email,
          MAIL_DISABLED
        })
        return
      } catch (e) {
        console.warn('Failed to create verification token', e)
      }
      res.json({
        success: true,
        verificationRequired: true,
        email: user.email,
        MAIL_DISABLED
      })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/verify', async (req, res) => {
    const token = req.query.token as string
    if (!token) return res.status(400).json({ error: 'token required' })
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const jti = payload?.jti
      if (!jti) return res.status(400).json({ error: 'invalid token' })
      const rows: any = await query('SELECT id, jti, user_id AS userId, purpose, expires_at AS expiresAt, used, used_at AS usedAt, revoked, created_at AS createdAt FROM `EmailToken` WHERE jti = ? LIMIT 1', [jti])
      const tokenRecord = rows && rows[0]
      if (!tokenRecord) return res.status(400).json({ error: 'token not found' })
      if (tokenRecord.revoked) return res.status(400).json({ error: 'token revoked' })
      if (tokenRecord.used) return res.status(400).json({ error: 'token already used' })
      if (new Date() > new Date(tokenRecord.expiresAt)) return res.status(400).json({ error: 'token expired' })
      if (tokenRecord.purpose !== 'VERIFY_EMAIL') return res.status(400).json({ error: 'invalid purpose' })

      await transaction(async (tx: any) => {
        await tx.query('UPDATE `EmailToken` SET used = ?, used_at = NOW() WHERE id = ?', [true, tokenRecord.id])
        await tx.query('UPDATE `User` SET is_verified = ?, updated_at = NOW() WHERE id = ?', [true, tokenRecord.userId])
      })

      try {
        const userRows: any = await query('SELECT email FROM `User` WHERE id = ? LIMIT 1', [tokenRecord.userId])
        const userEmail = userRows && userRows[0] ? userRows[0].email : null
        const forwardedFor = req.headers['x-forwarded-for'] as string | undefined
        const ipAddress = (forwardedFor && forwardedFor.split(',')[0].trim()) || req.ip || null
        const userAgent = (req.headers['user-agent'] as string | undefined) || null
        await query('INSERT INTO `EmailVerificationLog` (user_id, email, token_jti, verified_at, ip_address, user_agent, created_at) VALUES (?, ?, ?, NOW(), ?, ?, NOW())', [tokenRecord.userId, userEmail, tokenRecord.jti, ipAddress, userAgent])
      } catch (e) {
        console.warn('Failed to write email verification log', e)
      }

      res.json({ success: true })
    } catch (e: any) {
      res.status(400).json({ error: String(e.message || e) })
    }
  })

  router.get('/verify-status', async (req, res) => {
    const jti = String(req.query.jti || '')
    if (!jti) return res.status(400).json({ error: 'jti required' })
    try {
      const rows: any = await query('SELECT id, user_id AS userId, expires_at AS expiresAt, used, revoked FROM `EmailToken` WHERE jti = ? AND purpose = ? LIMIT 1', [jti, 'VERIFY_EMAIL'])
      const tokenRecord = rows && rows[0]
      if (!tokenRecord) return res.status(404).json({ error: 'token not found' })
      const expired = new Date() > new Date(tokenRecord.expiresAt)
      res.json({
        success: true,
        verified: !!tokenRecord.used,
        expired,
        revoked: !!tokenRecord.revoked
      })
    } catch (e: any) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })

  router.post('/resend-verify', authenticate, async (req: any, res) => {
    try {
      const userId = req.user?.userId
      if (!userId) return res.status(401).json({ error: 'unauthorized' })
      const rows: any = await query('SELECT id, email, role, is_verified AS isVerified FROM `User` WHERE id = ? LIMIT 1', [userId])
      const user = rows && rows[0]
      if (!user) return res.status(404).json({ error: 'user not found' })
      if (user.isVerified) return res.json({ success: true, alreadyVerified: true })
      if (MAIL_DISABLED) return res.status(503).json({ error: 'mail disabled', code: 'MAIL_DISABLED' })

      const limitCheck = await checkResendLimit(user.id)
      if (!limitCheck.ok) {
        return res.status(429).json({ error: 'rate limited', code: 'RATE_LIMIT', retryAfter: limitCheck.retryAfter })
      }

      const jti = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await query('INSERT INTO `EmailToken` (jti, user_id, purpose, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, false, NOW())', [jti, user.id, 'VERIFY_EMAIL', expiresAt])
      const verifyToken = jwt.sign({ jti, purpose: 'VERIFY_EMAIL' }, JWT_SECRET, { expiresIn: '24h' })
      const verifyLink = buildVerifyLink(verifyToken)
      const tmpl = buildVerifyEmail(verifyLink)
      await mailer.sendMail({ to: user.email, subject: tmpl.subject, text: tmpl.text, html: tmpl.html })

      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })

  router.post('/resend-verify-public', async (req, res) => {
    const { email, verificationId } = req.body || {}
    if (!email || !verificationId) return res.status(400).json({ error: 'email and verificationId required' })
    try {
      const rows: any = await query('SELECT id, email, is_verified AS isVerified FROM `User` WHERE email = ? LIMIT 1', [email])
      const user = rows && rows[0]
      if (!user) return res.status(404).json({ error: 'user not found' })
      if (user.isVerified) return res.json({ success: true, alreadyVerified: true })
      if (MAIL_DISABLED) return res.status(503).json({ error: 'mail disabled', code: 'MAIL_DISABLED' })

      const tokenRows: any = await query('SELECT id, user_id AS userId FROM `EmailToken` WHERE jti = ? AND purpose = ? LIMIT 1', [verificationId, 'VERIFY_EMAIL'])
      const tokenRec = tokenRows && tokenRows[0]
      if (!tokenRec || Number(tokenRec.userId) !== Number(user.id)) return res.status(400).json({ error: 'invalid verificationId' })

      const limitCheck = await checkResendLimit(user.id)
      if (!limitCheck.ok) {
        return res.status(429).json({ error: 'rate limited', code: 'RATE_LIMIT', retryAfter: limitCheck.retryAfter })
      }

      const jti = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await query('INSERT INTO `EmailToken` (jti, user_id, purpose, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, false, NOW())', [jti, user.id, 'VERIFY_EMAIL', expiresAt])
      const verifyToken = jwt.sign({ jti, purpose: 'VERIFY_EMAIL' }, JWT_SECRET, { expiresIn: '24h' })
      const verifyLink = buildVerifyLink(verifyToken)
      const tmpl = buildVerifyEmail(verifyLink)
      try {
        await mailer.sendMail({ to: user.email, subject: tmpl.subject, text: tmpl.text, html: tmpl.html })
      } catch (e: any) {
        console.warn('Failed to send resend-verify email', { email: user.email, error: e?.message || e })
      }

      res.json({ success: true, verificationId: jti })
    } catch (e: any) {
      res.status(500).json({ error: String(e.message || e) })
    }
  })

  router.post('/send-reset', async (req, res) => {
    const { email } = req.body as any
    if (!email) return res.status(400).json({ error: 'email required' })
    try {
      const rows: any = await query('SELECT id, uuid, email, password_hash AS passwordHash, name, phone, role, is_verified AS isVerified, created_at AS createdAt, updated_at AS updatedAt FROM `User` WHERE email = ? LIMIT 1', [email])
      const user = rows && rows[0]
      if (!user) return res.json({ success: true })
      try {
        const jti = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000)
        await query('INSERT INTO `EmailToken` (jti, user_id, purpose, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, false, NOW())', [jti, user.id, 'RESET_PASSWORD', expiresAt])
        const resetToken = jwt.sign({ jti, purpose: 'RESET_PASSWORD' }, JWT_SECRET, { expiresIn: '1h' })
        const webUrl = process.env.WEB_URL
        const resetLink = webUrl
          ? `${webUrl.replace(/\/$/, '')}/restablecer-contrasena?token=${resetToken}`
          : `${process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`}/auth/reset?token=${resetToken}`
        const tmpl = buildResetEmail(resetLink)
        await mailer.sendMail({ to: user.email, subject: tmpl.subject, text: tmpl.text, html: tmpl.html })
      } catch (e) {
        console.warn('Failed to send reset email', e)
      }
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.post('/reset', async (req, res) => {
    const { token, password } = req.body as any
    if (!token || !password) return res.status(400).json({ error: 'token and password required' })
    try {
      const payload: any = jwt.verify(token, JWT_SECRET)
      const jti = payload?.jti
      if (!jti) return res.status(400).json({ error: 'invalid token' })
      const rows: any = await query('SELECT id, jti, user_id AS userId, purpose, expires_at AS expiresAt, used, used_at AS usedAt, revoked, created_at AS createdAt FROM `EmailToken` WHERE jti = ? LIMIT 1', [jti])
      const tokenRecord = rows && rows[0]
      if (!tokenRecord) return res.status(400).json({ error: 'token not found' })
      if (tokenRecord.revoked) return res.status(400).json({ error: 'token revoked' })
      if (tokenRecord.used) return res.status(400).json({ error: 'token already used' })
      if (new Date() > new Date(tokenRecord.expiresAt)) return res.status(400).json({ error: 'token expired' })
      if (tokenRecord.purpose !== 'RESET_PASSWORD') return res.status(400).json({ error: 'invalid purpose' })

      const hash = await bcrypt.hash(password, 10)
      await transaction(async (tx: any) => {
        await tx.query('UPDATE `User` SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, tokenRecord.userId])
        await tx.query('UPDATE `EmailToken` SET used = ?, used_at = NOW() WHERE id = ?', [true, tokenRecord.id])
      })

      res.json({ success: true })
    } catch (e: any) {
      res.status(400).json({ error: String(e.message || e) })
    }
  })
}