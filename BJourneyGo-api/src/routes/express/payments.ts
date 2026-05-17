import { Router } from 'express'
import { registerStripePaymentHandlers } from './handlers/stripePaymentHandlers'
import { registerPaymentProcessingHandlers } from './handlers/paymentProcessingHandlers'
import { registerTicketPdfHandlers } from './handlers/ticketPdfHandlers'

const router = Router()

registerStripePaymentHandlers(router)
registerPaymentProcessingHandlers(router)
registerTicketPdfHandlers(router)

export default router
