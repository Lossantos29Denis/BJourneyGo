import { AuthPayload } from '../server/middleware'

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload
    }
  }
}

export {}
