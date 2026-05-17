import adminRouter from '../routes/express/admin'
import adminEmailTokensRouter from '../routes/express/adminEmailTokens'
import agencyRouter from '../routes/express/agency'
import authRouter from '../routes/express/auth'
import catalogRouter from '../routes/express/catalog'
import contactRouter from '../routes/express/contact'
import healthRouter from '../routes/express/health'
import offlineVerifyRouter from '../routes/express/offlineVerify'
import orderTicketsRouter from '../routes/express/orderTickets'
import ordersRouter from '../routes/express/orders'
import paymentsRouter from '../routes/express/payments'
import publicRouter from '../routes/express/public'
import qrRouter from '../routes/express/qr'
import ticketsRouter from '../routes/express/tickets'

type RouteMountTarget = {
  use: (...args: any[]) => any
}

type RouteMount = {
  path: string
  router: any
}

const standardRouteMounts: RouteMount[] = [
  { path: '/auth', router: authRouter },
  { path: '/health', router: healthRouter },
  { path: '/', router: catalogRouter },
  { path: '/', router: contactRouter },
  { path: '/', router: publicRouter },
  { path: '/orders', router: orderTicketsRouter },
  { path: '/orders', router: ordersRouter },
  { path: '/tickets', router: ticketsRouter },
  { path: '/tickets', router: qrRouter },
  { path: '/payments', router: paymentsRouter },
  { path: '/tickets', router: offlineVerifyRouter },
  { path: '/agency', router: agencyRouter },
  { path: '/admin/email-tokens', router: adminEmailTokensRouter },
  { path: '/admin', router: adminRouter },
]

export function registerStandardRoutes(target: RouteMountTarget) {
  for (const mount of standardRouteMounts) {
    target.use(mount.path, mount.router)
  }
}
