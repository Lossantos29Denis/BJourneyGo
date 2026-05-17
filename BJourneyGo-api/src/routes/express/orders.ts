import { Router } from 'express'
import { registerOrderHandlers } from './handlers/ordersHandlers'

const router = Router()

registerOrderHandlers(router)

export default router
