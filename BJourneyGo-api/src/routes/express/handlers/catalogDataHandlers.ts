import { Router } from 'express'
import { query } from '../../../lib/db'

export function registerCatalogDataHandlers(router: Router) {
  router.get('/routes', async (_req, res) => {
    try {
      const rows: any = await query('SELECT id, code, origin, destination, distance_km AS distanceKm, duration_minutes AS durationMinutes, status FROM `Route` WHERE status = ? ORDER BY origin, destination', ['ACTIVE'])
      res.json({ routes: rows })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/buses', async (_req, res) => {
    try {
      const rows: any = await query('SELECT id, plate, agency_id AS agencyId, capacity FROM `Bus` ORDER BY id')
      res.json({ buses: rows })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  router.get('/documents', async (_req, res) => {
    try {
      const rows: any = await query(
        'SELECT id, agency_id AS agencyId, title, category, description, file_url AS fileUrl, file_size AS fileSize, created_at AS createdAt, updated_at AS updatedAt FROM `Document` ORDER BY updated_at DESC'
      )
      res.json({ documents: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
