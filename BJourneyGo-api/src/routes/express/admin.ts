import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import { Router } from 'express'
import { query } from '../../lib/db'
import { registerAdminDocumentsHandlers } from './handlers/adminDocumentsHandlers'
import { registerAdminPeopleHandlers } from './handlers/adminPeopleHandlers'
import { registerAdminRoutesHandlers } from './handlers/adminRoutesHandlers'
import { registerAdminScheduleHandlers } from './handlers/adminScheduleHandlers'
import { registerAdminTripsHandlers } from './handlers/adminTripsHandlers'
import {
  getAgencyId,
  isAgency,
  mapAgencyWorkerRole,
  mapAgencyWorkerScannerEnabled,
  normalizeCommissionPercent,
  parseJson,
  requireAdmin,
  requireAuth,
  serializeAddress,
} from './utils/adminUtils'

const router = Router()

registerAdminRoutesHandlers(router)
registerAdminTripsHandlers(router)
registerAdminPeopleHandlers(router)
registerAdminScheduleHandlers(router)
registerAdminDocumentsHandlers(router)

// GET /admin/agencies
router.get('/agencies', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const rows: any = await query(
      'SELECT id, name, tax_id AS taxId, contact_email AS contactEmail, phone, address, stripe_account_id AS stripeAccountId, commission_percent AS commissionPercent, payout_active AS payoutActive, status, created_at AS createdAt, updated_at AS updatedAt FROM `Agency` ORDER BY name'
    )
    res.json({ agencies: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/agencies
router.post('/agencies', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { name, taxId, contactEmail, phone, address, stripeAccountId, commissionPercent, payoutActive, status } = req.body || {}
    if (!name) return res.status(400).json({ error: 'name required' })
    const normalizedCommission = normalizeCommissionPercent(commissionPercent, 10)
    if (normalizedCommission === null) return res.status(400).json({ error: 'commissionPercent must be between 0 and 100' })
    const addressJson = serializeAddress(address)
    const result: any = await query(
      'INSERT INTO `Agency` (name, tax_id, contact_email, phone, address, stripe_account_id, commission_percent, payout_active, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [name, taxId || null, contactEmail || null, phone || null, addressJson, stripeAccountId || null, normalizedCommission, payoutActive === undefined ? 1 : (payoutActive ? 1 : 0), status || 'ACTIVE']
    )
    res.json({ success: true, id: result?.insertId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/agencies/:id
router.put('/agencies/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    const { name, taxId, contactEmail, phone, address, stripeAccountId, commissionPercent, payoutActive, status } = req.body || {}
    const normalizedCommission = normalizeCommissionPercent(commissionPercent, null)
    if (normalizedCommission === null && commissionPercent !== undefined && commissionPercent !== null && commissionPercent !== '') {
      return res.status(400).json({ error: 'commissionPercent must be between 0 and 100' })
    }
    const addressJson = address ? serializeAddress(address) : null
    await query(
      'UPDATE `Agency` SET name = COALESCE(?, name), tax_id = COALESCE(?, tax_id), contact_email = COALESCE(?, contact_email), phone = COALESCE(?, phone), address = COALESCE(?, address), stripe_account_id = COALESCE(?, stripe_account_id), commission_percent = COALESCE(?, commission_percent), payout_active = COALESCE(?, payout_active), status = COALESCE(?, status), updated_at = NOW() WHERE id = ?',
      [name || null, taxId || null, contactEmail || null, phone || null, addressJson, stripeAccountId || null, normalizedCommission, payoutActive === undefined ? null : (payoutActive ? 1 : 0), status || null, id]
    )
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/agencies/:id
router.delete('/agencies/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    await query('DELETE FROM `Agency` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/stats
router.get('/stats', requireAuth, async (req: any, res) => {
  try {
    const role = req.user?.role
    const userId = Number(req.user?.userId)
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    const seriesStart = new Date(now.getFullYear(), now.getMonth() - 11, 1)

    let agencyFilter = ''
    const params: any[] = [monthStart, monthEnd]
    let revenueRows: any = [{ revenue: 0 }]
    let ticketsRows: any = [{ tickets: 0 }]
    let customersRows: any = [{ customers: 0 }]
    let monthlySeries: any[] = []
    let salesDistribution: any[] = []
    let timeSlots: any[] = []
    let performanceMetrics: any = {}
    if (isAgency(role)) {
      const agencyId = await getAgencyId(userId)
      agencyFilter = 'AND r.agency_id = ?'
      params.push(agencyId)
      revenueRows = await query(
        `SELECT COALESCE(SUM(tk.price),0) AS revenue
         FROM \`Ticket\` tk
         JOIN \`Order\` o ON o.id = tk.order_id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ? AND r.agency_id = ?`,
        [monthStart, monthEnd, agencyId]
      )
      ticketsRows = await query(
        `SELECT COUNT(*) AS tickets
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      )
      customersRows = await query(
        `SELECT COUNT(DISTINCT o.user_id) AS customers
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      )
      monthlySeries = (await query(
        `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS ym, COALESCE(SUM(tk.price),0) AS revenue
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ? AND r.agency_id = ?
         GROUP BY ym
         ORDER BY ym`,
        [seriesStart, monthEnd, agencyId]
      ) as any[])
      salesDistribution = (await query(
        `SELECT COALESCE(o.payment_method, 'OTROS') AS label, COUNT(*) AS value
         FROM \`Order\` o
         JOIN \`Ticket\` tk ON tk.order_id = o.id
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?
         GROUP BY label
         ORDER BY value DESC`,
        [agencyId]
      ) as any[])
      timeSlots = (await query(
        `SELECT
          SUM(CASE WHEN HOUR(t.departure_at) >= 6 AND HOUR(t.departure_at) < 9 THEN t.seats_sold ELSE 0 END) AS s1,
          SUM(CASE WHEN HOUR(t.departure_at) >= 9 AND HOUR(t.departure_at) < 12 THEN t.seats_sold ELSE 0 END) AS s2,
          SUM(CASE WHEN HOUR(t.departure_at) >= 12 AND HOUR(t.departure_at) < 15 THEN t.seats_sold ELSE 0 END) AS s3,
          SUM(CASE WHEN HOUR(t.departure_at) >= 15 AND HOUR(t.departure_at) < 18 THEN t.seats_sold ELSE 0 END) AS s4,
          SUM(CASE WHEN HOUR(t.departure_at) >= 18 AND HOUR(t.departure_at) < 21 THEN t.seats_sold ELSE 0 END) AS s5
         FROM \`Trip\` t
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])
      const purchaseRows: any = (await query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avgMinutes
         FROM \`Order\` o
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ?`,
        [monthStart, monthEnd]
      ) as any[])[0]
      const conversionRows: any = (await query(
        `SELECT
          SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) AS paid,
          COUNT(*) AS total
         FROM \`Order\` o
         WHERE o.created_at >= ? AND o.created_at < ? AND o.user_id IS NOT NULL`,
        [monthStart, monthEnd]
      ) as any[])[0]
      const avgTicketRows: any = (await query(
        `SELECT COALESCE(AVG(tk.price),0) AS avgTicket
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      const refundRows: any = (await query(
        `SELECT
          SUM(CASE WHEN tk.status = 'REFUNDED' THEN 1 ELSE 0 END) AS refunded,
          COUNT(*) AS total
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      const advanceRows: any = (await query(
        `SELECT
          SUM(CASE WHEN TIMESTAMPDIFF(HOUR, tk.issued_at, t.departure_at) >= 24 THEN 1 ELSE 0 END) AS advanceCnt,
          COUNT(*) AS total
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id
         JOIN \`Route\` r ON r.id = t.route_id
         WHERE r.agency_id = ?`,
        [agencyId]
      ) as any[])[0]
      performanceMetrics = {
        avgPurchaseMinutes: Number(purchaseRows?.avgMinutes || 0),
        conversionRate: conversionRows?.total ? Number(conversionRows.paid || 0) / Number(conversionRows.total || 1) : 0,
        avgTicket: Number(avgTicketRows?.avgTicket || 0),
        refundRate: refundRows?.total ? Number(refundRows.refunded || 0) / Number(refundRows.total || 1) : 0,
        advanceBookingRate: advanceRows?.total ? Number(advanceRows.advanceCnt || 0) / Number(advanceRows.total || 1) : 0
      }
    } else {
      revenueRows = await query(
        `SELECT COALESCE(SUM(o.total_amount),0) AS revenue FROM \`Order\` o WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ?`,
        [monthStart, monthEnd]
      )
      ticketsRows = await query('SELECT COUNT(*) AS tickets FROM `Ticket`', [])
      customersRows = await query('SELECT COUNT(DISTINCT o.user_id) AS customers FROM `Order` o', [])
      monthlySeries = (await query(
        `SELECT DATE_FORMAT(o.created_at, '%Y-%m') AS ym, COALESCE(SUM(o.total_amount),0) AS revenue
         FROM \`Order\` o
         WHERE o.status = 'PAID' AND o.created_at >= ? AND o.created_at < ?
         GROUP BY ym
         ORDER BY ym`,
        [seriesStart, monthEnd]
      ) as any[])
      salesDistribution = (await query(
        `SELECT COALESCE(o.payment_method, 'OTROS') AS label, COUNT(*) AS value
         FROM \`Order\` o
         GROUP BY label
         ORDER BY value DESC`
      ) as any[])
      timeSlots = (await query(
        `SELECT
          SUM(CASE WHEN HOUR(t.departure_at) >= 6 AND HOUR(t.departure_at) < 9 THEN t.seats_sold ELSE 0 END) AS s1,
          SUM(CASE WHEN HOUR(t.departure_at) >= 9 AND HOUR(t.departure_at) < 12 THEN t.seats_sold ELSE 0 END) AS s2,
          SUM(CASE WHEN HOUR(t.departure_at) >= 12 AND HOUR(t.departure_at) < 15 THEN t.seats_sold ELSE 0 END) AS s3,
          SUM(CASE WHEN HOUR(t.departure_at) >= 15 AND HOUR(t.departure_at) < 18 THEN t.seats_sold ELSE 0 END) AS s4,
          SUM(CASE WHEN HOUR(t.departure_at) >= 18 AND HOUR(t.departure_at) < 21 THEN t.seats_sold ELSE 0 END) AS s5
         FROM \`Trip\` t`,
        []
      ) as any[])
      const purchaseRows: any = (await query(
        `SELECT AVG(TIMESTAMPDIFF(MINUTE, o.created_at, o.updated_at)) AS avgMinutes
         FROM \`Order\` o
         WHERE o.status = 'PAID'`,
        []
      ) as any[])[0]
      const conversionRows: any = (await query(
        `SELECT
          SUM(CASE WHEN o.status = 'PAID' THEN 1 ELSE 0 END) AS paid,
          COUNT(*) AS total
         FROM \`Order\` o
         WHERE o.created_at >= ? AND o.created_at < ?`,
        [monthStart, monthEnd]
      ) as any[])[0]
      const avgTicketRows: any = (await query('SELECT AVG(price) AS avgTicket FROM `Ticket`', []) as any[])[0]
      const refundRows: any = (await query(
        `SELECT
          SUM(CASE WHEN status = 'REFUNDED' THEN 1 ELSE 0 END) AS refunded,
          COUNT(*) AS total
         FROM \`Ticket\``
      ) as any[])[0]
      const advanceRows: any = (await query(
        `SELECT
          SUM(CASE WHEN TIMESTAMPDIFF(HOUR, tk.issued_at, t.departure_at) >= 24 THEN 1 ELSE 0 END) AS advanceCnt,
          COUNT(*) AS total
         FROM \`Ticket\` tk
         JOIN \`Trip\` t ON t.id = tk.trip_id`,
        []
      ) as any[])[0]
      performanceMetrics = {
        avgPurchaseMinutes: Number(purchaseRows?.avgMinutes || 0),
        conversionRate: conversionRows?.total ? Number(conversionRows.paid || 0) / Number(conversionRows.total || 1) : 0,
        avgTicket: Number(avgTicketRows?.avgTicket || 0),
        refundRate: refundRows?.total ? Number(refundRows.refunded || 0) / Number(refundRows.total || 1) : 0,
        advanceBookingRate: advanceRows?.total ? Number(advanceRows.advanceCnt || 0) / Number(advanceRows.total || 1) : 0
      }
    }
    const occupancyRows: any = (await query(`SELECT COALESCE(AVG(CASE WHEN t.capacity > 0 THEN t.seats_sold / t.capacity ELSE 0 END),0) AS avgOcc FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id WHERE 1=1 ${agencyFilter}`, agencyFilter ? params.slice(2) : []) as any[])[0]

    const routesRows: any = await query(
      `SELECT r.code, r.origin, r.destination, SUM(t.seats_sold) AS sales, SUM(t.seats_sold * t.base_price) AS revenue, CASE WHEN SUM(t.capacity) > 0 THEN (SUM(t.seats_sold) / SUM(t.capacity)) * 100 ELSE 0 END AS occupancy
       FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id
       WHERE 1=1 ${agencyFilter}
       GROUP BY r.id, r.code, r.origin, r.destination
       ORDER BY sales DESC
       LIMIT 8`, agencyFilter ? params.slice(2) : [])

    const revenueData = Array.isArray(revenueRows) ? (revenueRows[0] || {}) : (revenueRows || {})
    const ticketsData = Array.isArray(ticketsRows) ? (ticketsRows[0] || {}) : (ticketsRows || {})
    const customersData = Array.isArray(customersRows) ? (customersRows[0] || {}) : (customersRows || {})

    res.json({
      monthlyRevenue: Number(revenueData?.revenue || 0),
      ticketsSold: Number(ticketsData?.tickets || 0),
      activeCustomers: Number(customersData?.customers || 0),
      averageOccupancy: Number(occupancyRows?.avgOcc || 0),
      popularRoutes: routesRows || [],
      monthlySeries: monthlySeries || [],
      salesDistribution: salesDistribution || [],
      timeSlots: timeSlots && timeSlots[0] ? timeSlots[0] : {},
      performanceMetrics
    })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/config
router.get('/config', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const rows: any = await query('SELECT config_key AS configKey, config_value AS configValue FROM `SystemConfig` WHERE scope = ? AND agency_id IS NULL', ['GLOBAL'])
    const data: any = {}
    ;(rows || []).forEach((row: any) => {
      data[row.configKey] = parseJson(row.configValue)
    })
    res.json({ config: data })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/config
router.put('/config', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const configs = req.body?.configs || null
    if (!configs || typeof configs !== 'object') return res.status(400).json({ error: 'configs object required' })

    const entries = Object.entries(configs)
    for (const [key, value] of entries) {
      await query(
        'INSERT INTO `SystemConfig` (scope, agency_id, config_key, config_value, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE config_value = VALUES(config_value), updated_at = NOW()',
        ['GLOBAL', null, key, JSON.stringify(value || null)]
      )
    }
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// GET /admin/users
router.get('/users', requireAuth, requireAdmin, async (_req: any, res) => {
  try {
    const rows: any = await query(
      `SELECT u.id, u.uuid, u.email, u.name, u.phone, u.role, u.is_verified AS isVerified, u.created_at AS createdAt,
        aw.agency_id AS agencyId, aw.role AS agencyWorkerRole, aw.scanner_enabled AS scannerEnabled, a.name AS agencyName, a.phone AS agencyPhone, a.address AS agencyAddress
       FROM \`User\` u
       LEFT JOIN \`AgencyWorker\` aw ON aw.user_id = u.id
       LEFT JOIN \`Agency\` a ON a.id = aw.agency_id
       ORDER BY u.created_at DESC`
    )
    res.json({ users: rows || [] })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// POST /admin/users
router.post('/users', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const { email, name, password, role, agencyId, agencyName, agencyPhone, agencyAddress } = req.body || {}
    if (!email || !password) return res.status(400).json({ error: 'email and password required' })
    const validRoles = ['USER', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_WORKER', 'SCANNER']
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'invalid role' })

    const existing: any = await query('SELECT id FROM `User` WHERE email = ? LIMIT 1', [email])
    if (existing && existing[0]) return res.status(409).json({ error: 'email already exists' })

    const hash = await bcrypt.hash(password, 10)
    const uuid = crypto.randomUUID()
    const requestedRole = role || 'USER'
    const userRole = requestedRole === 'SCANNER' ? 'USER' : requestedRole
    const result: any = await query(
      'INSERT INTO `User` (uuid, email, password_hash, name, role, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
      [uuid, email, hash, name || null, userRole]
    )
    const userId = result?.insertId

    if (requestedRole === 'AGENCY_ADMIN' || requestedRole === 'AGENCY_WORKER' || requestedRole === 'SCANNER') {
      let agency = agencyId
      if (!agency) {
        if (!agencyName) return res.status(400).json({ error: 'agencyName required' })
        const found: any = await query('SELECT id FROM `Agency` WHERE name = ? LIMIT 1', [agencyName])
        if (found && found[0]) {
          agency = found[0].id
        } else {
          const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
          const ins: any = await query(
            'INSERT INTO `Agency` (name, phone, address, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [agencyName, agencyPhone || null, addressJson, 'ACTIVE']
          )
          agency = ins?.insertId
        }
      }
      await query(
        'INSERT INTO `AgencyWorker` (user_id, agency_id, role, scanner_enabled, active) VALUES (?, ?, ?, ?, 1)',
        [userId, agency, mapAgencyWorkerRole(requestedRole), mapAgencyWorkerScannerEnabled(requestedRole)]
      )
    }

    res.json({ success: true, id: userId })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// PUT /admin/users/:id
router.put('/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })

    const { email, name, password, role, agencyId, agencyName, agencyPhone, agencyAddress } = req.body || {}
    const validRoles = ['USER', 'ADMIN', 'AGENCY_ADMIN', 'AGENCY_WORKER', 'SCANNER']
    if (role && !validRoles.includes(role)) return res.status(400).json({ error: 'invalid role' })

    const nextDbRole = role === 'SCANNER' ? 'USER' : role

    await query(
      'UPDATE `User` SET email = COALESCE(?, email), name = COALESCE(?, name), role = COALESCE(?, role), updated_at = NOW() WHERE id = ?',
      [email || null, name || null, nextDbRole || null, id]
    )

    if (password) {
      const hash = await bcrypt.hash(password, 10)
      await query('UPDATE `User` SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, id])
    }

    const existingAgency: any = await query(
      'SELECT aw.agency_id AS agencyId, aw.scanner_enabled AS scannerEnabled FROM `AgencyWorker` aw WHERE aw.user_id = ? LIMIT 1',
      [id]
    )
    const existingAgencyId = existingAgency && existingAgency[0] ? existingAgency[0].agencyId : null
    const existingScannerEnabled = existingAgency && existingAgency[0] ? Number(existingAgency[0].scannerEnabled || 0) : 0
    const nextRole = role

    if (nextRole === 'AGENCY_ADMIN' || nextRole === 'AGENCY_WORKER' || nextRole === 'SCANNER') {
      let agency = agencyId || existingAgencyId
      if (!agency) {
        if (!agencyName) return res.status(400).json({ error: 'agencyName required' })
        const found: any = await query('SELECT id FROM `Agency` WHERE name = ? LIMIT 1', [agencyName])
        if (found && found[0]) {
          agency = found[0].id
        } else {
          const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
          const ins: any = await query(
            'INSERT INTO `Agency` (name, phone, address, status, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
            [agencyName, agencyPhone || null, addressJson, 'ACTIVE']
          )
          agency = ins?.insertId
        }
      }

      if (existingAgencyId) {
        if (agencyName || agencyPhone || agencyAddress) {
          const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
          await query(
            'UPDATE `Agency` SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), updated_at = NOW() WHERE id = ?',
            [agencyName || null, agencyPhone || null, addressJson, agency]
          )
        }
        await query('UPDATE `AgencyWorker` SET agency_id = ?, role = ?, scanner_enabled = ? WHERE user_id = ?', [agency, mapAgencyWorkerRole(nextRole), mapAgencyWorkerScannerEnabled(nextRole), id])
      } else {
        await query(
          'INSERT INTO `AgencyWorker` (user_id, agency_id, role, scanner_enabled, active) VALUES (?, ?, ?, ?, 1)',
          [id, agency, mapAgencyWorkerRole(nextRole), mapAgencyWorkerScannerEnabled(nextRole)]
        )
      }
    } else if (nextRole) {
      if (existingAgencyId) {
        await query('DELETE FROM `AgencyWorker` WHERE user_id = ?', [id])
      }
    } else if (existingAgencyId && (agencyName || agencyPhone || agencyAddress)) {
      const addressJson = agencyAddress ? JSON.stringify({ line1: agencyAddress }) : null
      await query(
        'UPDATE `Agency` SET name = COALESCE(?, name), phone = COALESCE(?, phone), address = COALESCE(?, address), updated_at = NOW() WHERE id = ?',
        [agencyName || null, agencyPhone || null, addressJson, existingAgencyId]
      )
      if (existingScannerEnabled) {
        await query('UPDATE `AgencyWorker` SET scanner_enabled = 1 WHERE user_id = ?', [id])
      }
    }

    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

// DELETE /admin/users/:id
router.delete('/users/:id', requireAuth, requireAdmin, async (req: any, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'invalid id' })
    if (Number(req.user?.userId) === id) return res.status(400).json({ error: 'cannot delete self' })

    await query('DELETE FROM `AgencyWorker` WHERE user_id = ?', [id])
    await query('DELETE FROM `User` WHERE id = ?', [id])
    res.json({ success: true })
  } catch (e: any) {
    res.status(500).json({ error: String(e) })
  }
})

export default router
