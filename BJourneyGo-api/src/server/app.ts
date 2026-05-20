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
  app.use(morgan('combined'))
  
  // Custom body parser that skips multipart/form-data (handled by multer instead)
  app.use((req, res, next) => {
    const isMultipart = req.is('multipart/form-data')
    if (req.method === 'POST' && req.path.includes('upload')) {
      console.log('[MIDDLEWARE] Upload request:', {
        path: req.path,
        method: req.method,
        contentType: req.get('content-type'),
        isMultipart
      })
    }
    if (isMultipart) {
      return next()
    }
    express.json()(req, res, next)
  })

  fs.mkdirSync(uploadsDir, { recursive: true })
  app.use('/uploads', express.static(uploadsDir))
  app.use('/api/uploads', express.static(uploadsDir))

  registerStandardRoutes(app)

  const apiRouter = express.Router()
  registerStandardRoutes(apiRouter)
  app.use('/api', apiRouter)

  return app
}

export default createApp