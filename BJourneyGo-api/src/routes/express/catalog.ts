import { Router } from 'express'
import { registerCatalogDataHandlers } from './handlers/catalogDataHandlers'
import { registerCatalogTripsHandlers } from './handlers/catalogTripsHandlers'

const router = Router()

registerCatalogTripsHandlers(router)
registerCatalogDataHandlers(router)

export default router