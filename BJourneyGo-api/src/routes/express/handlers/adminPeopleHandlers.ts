import { Router } from 'express'
import { listBuses, listShiftUsers } from '../services/adminPeopleService'
import { getAgencyId, isAgency, requireAdminOrAgency, requireAuth } from '../utils/adminUtils'

export function registerAdminPeopleHandlers(router: Router) {
  // GET /admin/buses
  router.get('/buses', requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      const agencyId = isAgency(role) ? await getAgencyId(userId) : null
      const rows: any = await listBuses(agencyId)
      res.json({ buses: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // GET /admin/shift-users
  router.get('/shift-users', requireAuth, requireAdminOrAgency, async (req: any, res) => {
    try {
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      const agencyId = isAgency(role) ? await getAgencyId(userId) : null
      const rows: any = await listShiftUsers(agencyId)
      res.json({ users: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
