import cors from 'cors'
import dotenv from 'dotenv'
import express from 'express'
import fs from 'fs'
import morgan from 'morgan'
import path from 'path'
import { registerStandardRoutes } from './routeRegistry'

dotenv.config()

const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')

export function createApp() {
  const app = express()

  app.use(cors())
  app.use(express.json())
  app.use(morgan('combined'))

  fs.mkdirSync(uploadsDir, { recursive: true })
  app.use('/uploads', express.static(uploadsDir))

  registerStandardRoutes(app)

  const apiRouter = express.Router()
  registerStandardRoutes(apiRouter)
  app.use('/api', apiRouter)

  return app
}

export default createApp