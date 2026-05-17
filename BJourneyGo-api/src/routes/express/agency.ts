import { Router } from 'express'
import { registerAgencyHandlers } from './handlers/agencyHandlers'

const router = Router()

registerAgencyHandlers(router)

export default router
