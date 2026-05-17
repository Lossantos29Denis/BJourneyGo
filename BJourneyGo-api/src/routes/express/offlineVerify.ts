import { Router } from 'express'
import { registerOfflineVerifyHandlers } from './handlers/offlineVerifyHandlers'

const router = Router()

registerOfflineVerifyHandlers(router)

export default router
