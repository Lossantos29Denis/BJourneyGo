import { Router } from 'express'
import { registerAdminEmailTokensHandlers } from './handlers/adminEmailTokensHandlers'

const router = Router()

registerAdminEmailTokensHandlers(router)

export default router
