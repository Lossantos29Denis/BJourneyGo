import { Router } from 'express'
import { findCheckinOrder, findCheckinTickets, updateCheckinContact } from '../services/checkinService'
import {
    parseCheckinContactInput,
    parseCheckinLookupInput,
} from '../utils/checkinValidators.js'

export function registerPublicHandlers(router: Router) {
  router.post('/checkin/lookup', async (req, res) => {
    try {
      const input = parseCheckinLookupInput(req.body)
      if (!input) {
        return res.status(400).json({ error: 'referenceCode and identifier are required' })
      }

      const order = await findCheckinOrder(input.referenceCode, input.identifierRaw)
      if (!order) return res.status(404).json({ error: 'Reserva no encontrada' })

      const tickets = await findCheckinTickets(order.id)
      res.json({ order, tickets })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.post('/checkin/update-contact', async (req, res) => {
    try {
      const input = parseCheckinContactInput(req.body)
      if (!input) {
        return res.status(400).json({ error: 'referenceCode and identifier are required' })
      }
      if (!input.nextEmail && !input.nextPhone) {
        return res.status(400).json({ error: 'contactEmail or contactPhone is required' })
      }
      if (input.nextEmail && !/^\S+@\S+\.\S+$/.test(input.nextEmail)) {
        return res.status(400).json({ error: 'contactEmail is invalid' })
      }

      const order = await findCheckinOrder(input.referenceCode, input.identifierRaw)
      if (!order) return res.status(404).json({ error: 'Reserva no encontrada' })

      await updateCheckinContact(order.id, input.nextEmail, input.nextPhone)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
