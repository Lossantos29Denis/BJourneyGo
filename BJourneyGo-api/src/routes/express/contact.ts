import { Router } from 'express'
import { registerContactHandlers } from './handlers/contactHandlers'

const router = Router()

registerContactHandlers(router)

export default router