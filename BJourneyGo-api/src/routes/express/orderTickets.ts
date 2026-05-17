import { Router } from 'express'
import { registerOrderTicketsHandlers } from './handlers/orderTicketsHandlers'

const router = Router()

registerOrderTicketsHandlers(router)

export default router