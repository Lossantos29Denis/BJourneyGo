import { Router } from 'express'
import { registerPublicHandlers } from './handlers/publicHandlers'

const router = Router()

registerPublicHandlers(router)

export default router
