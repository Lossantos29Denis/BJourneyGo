import { Router } from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { createDocument, deleteDocument, listDocuments, updateDocument } from '../services/adminDocumentsService'
import { getAgencyId, isAgency, requireAdmin, requireAuth } from '../utils/adminUtils'

const maxUploadBytes = Number(process.env.DOCS_MAX_UPLOAD_BYTES || 25 * 1024 * 1024)
const uploadsRoot = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
const documentsDir = path.join(uploadsRoot, 'documents')
fs.mkdirSync(documentsDir, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => cb(null, documentsDir),
  filename: (_req: any, file: any, cb: any) => {
    const ext = path.extname(file.originalname || '').toLowerCase()
    const safeExt = ext && ext.length <= 8 ? ext : ''
    const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${safeExt}`
    cb(null, name)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: maxUploadBytes }
})

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${mb.toFixed(1)} MB`
  const gb = mb / 1024
  return `${gb.toFixed(1)} GB`
}

export function registerAdminDocumentsHandlers(router: Router) {
  // POST /admin/documents/upload
  router.post('/documents/upload', requireAuth, requireAdmin, upload.single('file'), async (req: any, res) => {
    try {
      const file = req.file
      if (!file) return res.status(400).json({ error: 'file required' })
      const fileUrl = `/uploads/documents/${file.filename}`
      const fileSize = formatFileSize(file.size)
      res.json({ success: true, fileUrl, fileSize, originalName: file.originalname })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // GET /admin/documents
  router.get('/documents', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const role = req.user?.role
      const userId = Number(req.user?.userId)
      const category = req.query.category ? String(req.query.category) : null
      const agencyId = isAgency(role) ? await getAgencyId(userId) : null
      const rows: any = await listDocuments({ category, agencyId })
      res.json({ documents: rows || [] })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // POST /admin/documents
  router.post('/documents', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const { title, category, description, fileUrl, fileSize, agencyId } = req.body || {}
      if (!title) return res.status(400).json({ error: 'title required' })
      const id = await createDocument({
        title,
        category: category || null,
        description: description || null,
        fileUrl: fileUrl || null,
        fileSize: fileSize || null,
        agencyId: agencyId || null,
      })
      res.json({ success: true, id })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // PUT /admin/documents/:id
  router.put('/documents/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      const { title, category, description, fileUrl, fileSize, agencyId } = req.body || {}
      await updateDocument({
        id,
        title: title || null,
        category: category || null,
        description: description || null,
        fileUrl: fileUrl || null,
        fileSize: fileSize || null,
        agencyId: agencyId || null,
      })
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // DELETE /admin/documents/:id
  router.delete('/documents/:id', requireAuth, requireAdmin, async (req: any, res) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      await deleteDocument(id)
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
