import { Router } from 'express'
import { query } from '../../../lib/db'

export function registerCatalogTripsHandlers(router: Router) {
  router.get('/trips', async (req, res) => {
    try {
      const { q, origin, destination, startDate, endDate } = req.query as any
      const queryText = String(q || '').trim()
      const originText = String(origin || '').trim()
      const destinationText = String(destination || '').trim()
      const start = String(startDate || '').trim()
      const end = String(endDate || '').trim()

      if (!queryText && (!originText || !destinationText) && !start && !end) {
        return res.status(400).json({ error: 'q or origin/destination with optional date range are required' })
      }
      if ((start && !end) || (!start && end)) {
        return res.status(400).json({ error: 'startDate and endDate must be provided together' })
      }
      if (start || end) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
          return res.status(400).json({ error: 'invalid date format, expected YYYY-MM-DD' })
        }
        if (end < start) {
          return res.status(400).json({ error: 'endDate must be greater than or equal to startDate' })
        }
      }

      const clauses: string[] = ["t.status = 'SCHEDULED'"]
      const params: any[] = []

      if (queryText) {
        const qLike = `%${queryText.toLowerCase()}%`
        clauses.push('(LOWER(r.code) LIKE ? OR LOWER(r.origin) LIKE ? OR LOWER(r.destination) LIKE ?)')
        params.push(qLike, qLike, qLike)
      } else {
        clauses.push('LOWER(r.origin) LIKE ?')
        params.push(`%${originText.toLowerCase()}%`)
        clauses.push('LOWER(r.destination) LIKE ?')
        params.push(`%${destinationText.toLowerCase()}%`)
      }

      if (start && end) {
        clauses.push('t.departure_at >= ?')
        params.push(`${start} 00:00:00`)
        clauses.push('t.departure_at < DATE_ADD(?, INTERVAL 1 DAY)')
        params.push(`${end} 00:00:00`)
      }

      const where = clauses.length ? 'WHERE ' + clauses.join(' AND ') : ''
      const sql = `SELECT t.id, t.route_id AS routeId, r.code AS routeCode, r.origin, r.destination, DATE_FORMAT(t.departure_at, '%Y-%m-%d %H:%i:%s') AS departureAt, DATE_FORMAT(t.arrival_at, '%Y-%m-%d %H:%i:%s') AS arrivalAt, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice FROM \`Trip\` t JOIN \`Route\` r ON r.id = t.route_id ${where} ORDER BY t.departure_at ASC LIMIT 200`
      const rows: any = await query(sql, params)
      res.json({ trips: rows })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/trips/:id', async (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const rows: any = await query('SELECT t.id, t.route_id AS routeId, r.code AS routeCode, r.origin, r.destination, t.bus_id AS busId, DATE_FORMAT(t.departure_at, \'%Y-%m-%d %H:%i:%s\') AS departureAt, DATE_FORMAT(t.arrival_at, \'%Y-%m-%d %H:%i:%s\') AS arrivalAt, t.capacity, t.seats_sold AS seatsSold, t.base_price AS basePrice FROM `Trip` t JOIN `Route` r ON r.id = t.route_id WHERE t.id = ? LIMIT 1', [id])
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'not found' })
      res.json({ trip: rows[0] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
