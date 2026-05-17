import { Router } from 'express'
import {
    calendarEventOwnedByUser,
    createCalendarEvent,
    createShift,
    deleteCalendarEvent,
    deleteShift,
    listCalendarEvents,
    listShifts,
    shiftBelongsToAgency,
    updateCalendarEvent,
    updateShift,
} from '../services/adminScheduleService'
import {
    getAgencyId,
    getUserAgencyId,
    isAgency,
    parseJson,
    requireAdminOrAgency,
    requireAuth,
} from '../utils/adminUtils'

export function registerAdminScheduleHandlers(router: Router) {
  // GET /admin/shifts
  router.get('/shifts', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      const month = String(req.query.month || '')
      let startDate: Date | null = null
      let endDate: Date | null = null
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, mon] = month.split('-').map(Number)
        startDate = new Date(year, mon - 1, 1)
        endDate = new Date(year, mon, 1)
      }

      let agencyId: number | null = null
      if (isAgency(role)) {
        agencyId = await getAgencyId(userId)
      } else if (req.query.agencyId) {
        agencyId = Number(req.query.agencyId)
      }

      const rows: any = await listShifts({ startDate, endDate, agencyId })
      res.json({ shifts: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // POST /admin/shifts
  router.post('/shifts', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const { userId, shiftDate, shiftType, notes, agencyId } = req.body || {}
      if (!userId || !shiftDate || !shiftType) return res.status(400).json({ error: 'userId, shiftDate, shiftType required' })
      const role = req.user?.role
      const requesterId = Number(req.user?.userId)

      let agency = agencyId ? Number(agencyId) : null
      if (isAgency(role)) {
        agency = await getAgencyId(requesterId)
      }

      const userAgencyId = await getUserAgencyId(Number(userId))
      if (isAgency(role) && userAgencyId !== agency) return res.status(403).json({ error: 'user not in agency' })
      if (!agency) agency = userAgencyId

      const id = await createShift({ userId: Number(userId), agencyId: agency || null, shiftDate, shiftType, notes })
      res.json({ success: true, id })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // PUT /admin/shifts/:id
  router.put('/shifts/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const role = req.user?.role
      const requesterId = Number(req.user?.userId)
      if (isAgency(role)) {
        const agencyId = await getAgencyId(requesterId)
        const allowed = await shiftBelongsToAgency(id, Number(agencyId))
        if (!allowed) return res.status(403).json({ error: 'not allowed' })
      }
      const { shiftDate, shiftType, notes } = req.body || {}
      await updateShift({ id, shiftDate, shiftType, notes })
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // DELETE /admin/shifts/:id
  router.delete('/shifts/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const role = req.user?.role
      const requesterId = Number(req.user?.userId)
      if (isAgency(role)) {
        const agencyId = await getAgencyId(requesterId)
        const allowed = await shiftBelongsToAgency(id, Number(agencyId))
        if (!allowed) return res.status(403).json({ error: 'not allowed' })
      }
      await deleteShift(id)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // GET /admin/calendar-events
  router.get('/calendar-events', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const userId = Number(req.user?.userId)
      const month = String(req.query.month || '')
      let startDate: Date | null = null
      let endDate: Date | null = null
      if (month && /^\d{4}-\d{2}$/.test(month)) {
        const [year, mon] = month.split('-').map(Number)
        startDate = new Date(year, mon - 1, 1)
        endDate = new Date(year, mon, 1)
      }

      const rows: any = await listCalendarEvents({ userId, startDate, endDate })
      const events = (rows || []).map((row: any) => ({
        ...row,
        details: parseJson(row.details)
      }))
      res.json({ events })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // POST /admin/calendar-events
  router.post('/calendar-events', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const userId = Number(req.user?.userId)
      const { title, startAt, endAt, details } = req.body || {}
      if (!title || !startAt) return res.status(400).json({ error: 'title and startAt required' })

      const agencyId = await getUserAgencyId(userId)
      const id = await createCalendarEvent({ userId, agencyId: agencyId || null, title, startAt, endAt, details })
      res.json({ success: true, id })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // PUT /admin/calendar-events/:id
  router.put('/calendar-events/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const userId = Number(req.user?.userId)
      const allowed = await calendarEventOwnedByUser(id, userId)
      if (!allowed) return res.status(403).json({ error: 'not allowed' })

      const { title, startAt, endAt, details } = req.body || {}
      await updateCalendarEvent({ id, title, startAt, endAt, details })
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // DELETE /admin/calendar-events/:id
  router.delete('/calendar-events/:id', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const userId = Number(req.user?.userId)
      const allowed = await calendarEventOwnedByUser(id, userId)
      if (!allowed) return res.status(403).json({ error: 'not allowed' })
      await deleteCalendarEvent(id)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
