import express from 'express'
import cors from 'cors'
import morgan from 'morgan'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import authRouter from '../routes/express/auth'
import healthRouter from '../routes/express/health'
import ordersRouter from '../routes/express/orders'
import ticketsRouter from '../routes/express/tickets'
import qrRouter from '../routes/express/qr'
import paymentsRouter from '../routes/express/payments'
import offlineVerifyRouter from '../routes/express/offlineVerify'
import agencyRouter from '../routes/express/agency'
import adminEmailTokensRouter from '../routes/express/adminEmailTokens'
import { runStartupChecks } from '../lib/startupChecks'
import publicRouter from '../routes/express/public'
import adminRouter from '../routes/express/admin'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('combined'))

const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.use('/auth', authRouter)
app.use('/health', healthRouter)
app.use('/', publicRouter)
app.use('/orders', ordersRouter)
app.use('/tickets', ticketsRouter)
app.use('/tickets', qrRouter)
app.use('/payments', paymentsRouter)
app.use('/tickets', offlineVerifyRouter)
app.use('/agency', agencyRouter)
app.use('/admin/email-tokens', adminEmailTokensRouter)
app.use('/admin', adminRouter)

const port = Number(process.env.PORT || 4000)

async function start() {
  try {
    await runStartupChecks()
  } catch (e: any) {
    console.error('Startup checks failed:', String(e))
    process.exit(1)
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening at http://0.0.0.0:${port}`)
  })
}

start()

export default app
