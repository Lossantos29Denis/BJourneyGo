import { Router } from 'express'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import jwt from 'jsonwebtoken'
import { query, transaction } from '../../lib/db'
import authenticate from '../../server/middleware'
import mailer from '../../lib/mailer'
import { buildResetEmail, buildVerifyEmail } from '../../lib/emailTemplates'

const router = Router()
const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-to-a-strong-value'
const REFRESH_TOKEN_TTL_SECONDS = Number(process.env.REFRESH_TOKEN_TTL_SECONDS || 60 * 60 * 24 * 7) // 7 days
const mailDisabled = String(process.env.MAIL_DISABLED || 'false').toLowerCase() === 'true'
const RESEND_MIN_SECONDS = Number(process.env.VERIFY_RESEND_MIN_SECONDS || 60)
const RESEND_MAX_PER_HOUR = Number(process.env.VERIFY_RESEND_MAX_PER_HOUR || 3)

async function resolveEffectiveAuthContext(userId: number, dbRole: string) {
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

function buildVerifyLink(token: string) {
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 4000}`
  const webUrl = process.env.WEB_URL
  return webUrl
    ? `${webUrl.replace(/\/$/, '')}/verify?token=${token}`
    : `${apiUrl}/auth/verify?token=${token}`
}

async function checkResendLimit(userId: number) {
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

    // create email token and send verification
    try {
      const jti = crypto.randomUUID()
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
      await query('INSERT INTO `EmailToken` (jti, user_id, purpose, expires_at, revoked, created_at) VALUES (?, ?, ?, ?, false, NOW())', [jti, user.id, 'VERIFY_EMAIL', expiresAt])
      const verifyToken = jwt.sign({ jti, purpose: 'VERIFY_EMAIL' }, JWT_SECRET, { expiresIn: '24h' })
      const verifyLink = buildVerifyLink(verifyToken)
      // Fire-and-forget: respond immediately so the modal appears without waiting for SMTP
      if (!mailDisabled) {
        const tmpl = buildVerifyEmail(verifyLink)
        mailer.sendMail({ to: user.email, subject: tmpl.subject, text: tmpl.text, html: tmpl.html })
          .catch((e: any) => console.warn('Failed to send verification email', e))
      }

      res.json({
        success: true,
        verificationRequired: true,
        verificationId: jti,
        email: user.email,
        mailDisabled
      })
      return
    } catch (e) {
      console.warn('Failed to create verification token', e)
    }
    res.json({
      success: true,
      verificationRequired: true,
      email: user.email,
      mailDisabled
    })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// Refresh endpoint: swap refresh token for new access token
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

// Logout: revoke refresh token
router.post('/logout', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken required' })
  try {
    const payload: any = jwt.verify(refreshToken, JWT_SECRET)
    const jti = payload?.jti
    if (!jti) return res.status(400).json({ error: 'invalid token' })
    await query('UPDATE `RefreshToken` SET revoked = 1 WHERE jti = ?', [jti])

    // also revoke provided access token if present in Authorization header
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
    if (mailDisabled) return res.status(503).json({ error: 'mail disabled', code: 'MAIL_DISABLED' })

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
    if (mailDisabled) return res.status(503).json({ error: 'mail disabled', code: 'MAIL_DISABLED' })

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
    // Fire-and-forget: respond immediately so the client isn't blocked by SMTP
    mailer.sendMail({ to: user.email, subject: tmpl.subject, text: tmpl.text, html: tmpl.html })
      .catch((e: any) => console.warn('Failed to send resend-verify email', e))

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
    // If mail sending is disabled (e.g. in dev), allow login even if not verified
    if (!user.isVerified && user.role !== 'ADMIN' && !mailDisabled) {
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

// protected /me
router.get('/me', async (req: any, res) => {
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

// Update profile (name, phone)
router.put('/me', async (req: any, res) => {
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

// Change password (requires current password)
router.post('/me/change-password', async (req: any, res) => {
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

// Delete account (requires current password confirmation)
router.delete('/me', async (req: any, res) => {
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

    // remove refresh tokens and user record
    await query('DELETE FROM `RefreshToken` WHERE user_id = ?', [payload.userId])
    await query('DELETE FROM `User` WHERE id = ?', [payload.userId])

    res.json({ success: true })
  } catch (e: any) {
    res.status(401).json({ error: 'invalid token' })
  }
})

export default router
