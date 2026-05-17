import { Router } from 'express'
import {
    busesAllowedForAgency,
    createRoundTrip,
    createTrip,
    deleteTrip,
    getTripSchedule,
    listTrips,
    routeAllowedForAgency,
    routesAllowedForAgency,
    updateTrip,
} from '../services/adminTripsService'
import {
    getAgencyId,
    isAgency,
    parseDateTimeInput,
    requireAuth,
    toSqlDateTime,
} from '../utils/adminUtils'

export function registerAdminTripsHandlers(router: Router) {
  // GET /admin/trips
  router.get('/trips', requireAuth, async (req: any, res) => {
    try {
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      const agencyId = isAgency(role) ? await getAgencyId(userId) : null
      const rows: any = await listTrips(agencyId)
      res.json({ trips: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // POST /admin/trips
  router.post('/trips', requireAuth, async (req: any, res) => {
    try {
      const { routeId, busId, departureAt, arrivalAt, capacity, basePrice, status } = req.body || {}
      if (!routeId || !departureAt || !arrivalAt) {
        return res.status(400).json({ error: 'routeId, departureAt, arrivalAt required' })
      }
      const parsedDeparture = parseDateTimeInput(departureAt)
      const parsedArrival = parseDateTimeInput(arrivalAt)
      if (!parsedDeparture || !parsedArrival) return res.status(400).json({ error: 'invalid departureAt/arrivalAt' })
      if (parsedArrival.getTime() <= parsedDeparture.getTime()) {
        return res.status(400).json({ error: 'arrivalAt must be after departureAt' })
      }

      const role = req.user?.role
      const userId = Number(req.user?.userId)
      if (isAgency(role)) {
        const agencyId = await getAgencyId(userId)
        const allowedRoute = await routeAllowedForAgency(Number(routeId), Number(agencyId))
        if (!allowedRoute) return res.status(403).json({ error: 'route not allowed' })
        if (busId) {
          const busesAllowed = await busesAllowedForAgency([Number(busId)], Number(agencyId))
          if (!busesAllowed) return res.status(403).json({ error: 'bus not allowed' })
        }
      }

      const id = await createTrip({
        routeId: Number(routeId),
        busId: busId ? Number(busId) : null,
        departureAt: toSqlDateTime(parsedDeparture),
        arrivalAt: toSqlDateTime(parsedArrival),
        capacity: Number(capacity || 0),
        basePrice: Number(basePrice || 0),
        status: String(status || 'SCHEDULED'),
      })

      res.json({ success: true, id })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // POST /admin/trips/roundtrip
  router.post('/trips/roundtrip', requireAuth, async (req: any, res) => {
    try {
      const outbound = req.body?.outbound || {}
      const ret = req.body?.returnTrip || {}

      const outboundRouteId = Number(outbound.routeId || 0)
      const outboundBusId = outbound.busId ? Number(outbound.busId) : null
      const outboundDepartureRaw = String(outbound.departureAt || '')
      const outboundArrivalRaw = String(outbound.arrivalAt || '')
      const outboundCapacity = Number(outbound.capacity || 0)
      const outboundPrice = Number(outbound.basePrice || 0)
      const outboundStatus = String(outbound.status || 'SCHEDULED')

      const returnRouteId = Number(ret.routeId || 0)
      const returnBusId = ret.busId ? Number(ret.busId) : null
      const returnDepartureRaw = String(ret.departureAt || '')
      const returnArrivalRaw = String(ret.arrivalAt || '')
      const returnCapacity = Number(ret.capacity || 0)
      const returnPrice = Number(ret.basePrice || 0)
      const returnStatus = String(ret.status || 'SCHEDULED')

      if (!outboundRouteId || !outboundDepartureRaw || !outboundArrivalRaw || !returnRouteId || !returnDepartureRaw || !returnArrivalRaw) {
        return res.status(400).json({ error: 'outbound and returnTrip routeId/departureAt/arrivalAt are required' })
      }

      const outboundDeparture = parseDateTimeInput(outboundDepartureRaw)
      const outboundArrival = parseDateTimeInput(outboundArrivalRaw)
      const returnDeparture = parseDateTimeInput(returnDepartureRaw)
      const returnArrival = parseDateTimeInput(returnArrivalRaw)

      if (!outboundDeparture || !outboundArrival || !returnDeparture || !returnArrival) {
        return res.status(400).json({ error: 'invalid departureAt/arrivalAt in outbound or returnTrip' })
      }
      if (outboundArrival.getTime() <= outboundDeparture.getTime()) {
        return res.status(400).json({ error: 'outbound arrivalAt must be after departureAt' })
      }
      if (returnArrival.getTime() <= returnDeparture.getTime()) {
        return res.status(400).json({ error: 'return arrivalAt must be after departureAt' })
      }

      const role = req.user?.role
      const userId = Number(req.user?.userId)
      if (isAgency(role)) {
        const agencyId = await getAgencyId(userId)
        const routesAllowed = await routesAllowedForAgency([outboundRouteId, returnRouteId], Number(agencyId))
        if (!routesAllowed) return res.status(403).json({ error: 'route not allowed' })

        const busIds = [outboundBusId, returnBusId].filter((id): id is number => Number(id) > 0)
        const busesAllowed = await busesAllowedForAgency(busIds, Number(agencyId))
        if (!busesAllowed) return res.status(403).json({ error: 'bus not allowed' })
      }

      const result = await createRoundTrip({
        outbound: {
          routeId: outboundRouteId,
          busId: outboundBusId,
          departureAt: toSqlDateTime(outboundDeparture),
          arrivalAt: toSqlDateTime(outboundArrival),
          capacity: outboundCapacity || 0,
          basePrice: outboundPrice || 0,
          status: outboundStatus,
        },
        returnTrip: {
          routeId: returnRouteId,
          busId: returnBusId,
          departureAt: toSqlDateTime(returnDeparture),
          arrivalAt: toSqlDateTime(returnArrival),
          capacity: returnCapacity || 0,
          basePrice: returnPrice || 0,
          status: returnStatus,
        },
      })

      res.json({ success: true, ...result })
    } catch (e: any) {
      res.status(500).json({ error: String(e?.message || e) })
    }
  })

  // PUT /admin/trips/:id
  router.put('/trips/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      const { departureAt, arrivalAt, capacity, basePrice, status } = req.body || {}
      if (!id) return res.status(400).json({ error: 'invalid id' })

      const parsedDeparture = departureAt === undefined ? null : parseDateTimeInput(departureAt)
      const parsedArrival = arrivalAt === undefined ? null : parseDateTimeInput(arrivalAt)
      if (departureAt !== undefined && !parsedDeparture) return res.status(400).json({ error: 'invalid departureAt' })
      if (arrivalAt !== undefined && !parsedArrival) return res.status(400).json({ error: 'invalid arrivalAt' })

      if (parsedDeparture || parsedArrival) {
        const trip = await getTripSchedule(id)
        if (!trip) return res.status(404).json({ error: 'trip not found' })
        const effectiveDeparture = parsedDeparture || parseDateTimeInput(trip.departureAt)
        const effectiveArrival = parsedArrival || parseDateTimeInput(trip.arrivalAt)
        if (!effectiveDeparture || !effectiveArrival) return res.status(400).json({ error: 'invalid trip schedule data' })
        if (effectiveArrival.getTime() <= effectiveDeparture.getTime()) {
          return res.status(400).json({ error: 'arrivalAt must be after departureAt' })
        }
      }

      const nextCapacity = capacity === undefined ? null : Number(capacity)
      const nextBasePrice = basePrice === undefined ? null : Number(basePrice)
      if (nextCapacity !== null && (!Number.isFinite(nextCapacity) || nextCapacity < 0)) {
        return res.status(400).json({ error: 'invalid capacity' })
      }
      if (nextBasePrice !== null && (!Number.isFinite(nextBasePrice) || nextBasePrice < 0)) {
        return res.status(400).json({ error: 'invalid basePrice' })
      }

      await updateTrip({
        id,
        departureAt: parsedDeparture ? toSqlDateTime(parsedDeparture) : null,
        arrivalAt: parsedArrival ? toSqlDateTime(parsedArrival) : null,
        capacity: nextCapacity,
        basePrice: nextBasePrice,
        status: status || null,
      })

      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // DELETE /admin/trips/:id
  router.delete('/trips/:id', requireAuth, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      await deleteTrip(id)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
