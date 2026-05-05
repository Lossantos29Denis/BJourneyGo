import { Router } from 'express'
import { query } from '../../lib/db'

const router = Router()

router.get('/', async (req, res) => {
  try {
    const users = await query('SELECT 1')
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) })
  }
})

export default router
