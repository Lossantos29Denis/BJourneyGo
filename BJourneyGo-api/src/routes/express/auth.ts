import { Router } from 'express'
import { registerAuthEmailHandlers } from './handlers/authEmailHandlers'
import { registerAuthProfileHandlers } from './handlers/authProfileHandlers'
import { registerAuthSessionHandlers } from './handlers/authSessionHandlers'

const router = Router()

registerAuthEmailHandlers(router)
registerAuthProfileHandlers(router)
registerAuthSessionHandlers(router)

export default router
