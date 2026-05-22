import { Router } from 'express'
import { query } from '../../../lib/db'
import { authenticate } from '../../../server/middleware'
import { createPurchaseOrder, listUserOrders, loadOrderWithTickets } from '../services/orderService'
import { canAccessOrder } from '../utils/accessControl.js'

export function registerOrderHandlers(router: Router) {
  router.post('/purchase', authenticate, async (req: any, res) => {
    const { tripId, quantity = 1, paymentProvider, providerRef } = req.body || {}
    if (!tripId || quantity <= 0) return res.status(400).json({ error: 'tripId and positive quantity required' })
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'unauthorized' })

    try {
      const result = await createPurchaseOrder({
        userId: Number(userId),
        tripId: Number(tripId),
        quantity: Number(quantity),
        paymentProvider,
        providerRef,
      })

      res.json(result)
    } catch (e: any) {
      res.status(400).json({ error: String(e.message || e) })
    }
  })

  router.get('/my', authenticate, async (req: any, res) => {
    const userId = req.user?.userId
    if (!userId) return res.status(401).json({ error: 'unauthorized' })
    try {
      const userRows: any = await query('SELECT email FROM `User` WHERE id = ? LIMIT 1', [Number(userId)])
      const userEmail = String(userRows?.[0]?.email || '').trim().toLowerCase()
      const orders = await listUserOrders(Number(userId), userEmail)
      res.json({ orders })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/:id', authenticate, async (req: any, res) => {
    const id = Number(req.params.id)
    const payload = req.user
    const role = payload?.role
    const requesterId = payload?.userId
    try {
      const userRows: any = requesterId ? await query('SELECT email FROM `User` WHERE id = ? LIMIT 1', [Number(requesterId)]) : []
      const requesterEmail = String(userRows?.[0]?.email || '').trim().toLowerCase()
      const rows: any = await loadOrderWithTickets(id)
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'order not found' })
      const order = rows[0]
      if (!canAccessOrder(order.userId, requesterId, role, order.contactEmail, requesterEmail)) return res.status(403).json({ error: 'forbidden' })
      res.json({ order, tickets: rows })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
