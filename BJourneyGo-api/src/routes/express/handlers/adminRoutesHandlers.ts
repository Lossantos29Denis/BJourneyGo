import { Router } from 'express'
import {
    createRoute,
    deleteRoute,
    listRoutes,
    updateRoute,
} from '../services/adminRoutesService'
import {
    getAgencyId,
    isAgency,
    requireAuth,
} from '../utils/adminUtils'

export function registerAdminRoutesHandlers(router: Router) {
  // GET /admin/routes
  router.get('/routes', requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      const agencyId = isAgency(role) ? await getAgencyId(userId) : null
      const rows: any = await listRoutes(agencyId)
      res.json({ routes: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // POST /admin/routes
  router.post('/routes', requireAuth, async (req: any, res) => {
    try {
      const { code, origin, destination, distanceKm, durationMinutes, status, agencyId } = req.body || {}
      if (!code || !origin || !destination) return res.status(400).json({ error: 'code, origin, destination required' })
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      let agency = agencyId ? Number(agencyId) : null
      if (isAgency(role)) agency = await getAgencyId(userId)
      if (isAgency(role) && !agency) return res.status(400).json({ error: 'agencyId required' })

      const id = await createRoute({ code, origin, destination, distanceKm, durationMinutes, status, agencyId: agency })
      res.json({ success: true, id })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // PUT /admin/routes/:id
  router.put('/routes/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      const { code, origin, destination, distanceKm, durationMinutes, status, basePrice } = req.body || {}
      if (!id) return res.status(400).json({ error: 'invalid id' })

      let nextBasePrice: number | undefined
      if (basePrice !== undefined && basePrice !== null && basePrice !== '') {
        const parsed = Number(basePrice)
        if (!Number.isFinite(parsed) || parsed < 0) {
          return res.status(400).json({ error: 'invalid basePrice' })
        }
        nextBasePrice = parsed
      }

      await updateRoute({
        id,
        code,
        origin,
        destination,
        distanceKm,
        durationMinutes,
        status,
        basePrice: nextBasePrice,
      })

      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // DELETE /admin/routes/:id
  router.delete('/routes/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      await deleteRoute(id)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
