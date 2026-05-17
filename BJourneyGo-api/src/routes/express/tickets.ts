import { Router } from 'express'
import { registerTicketsHandlers } from './handlers/ticketsHandlers'

const router = Router()

registerTicketsHandlers(router)

export default router
