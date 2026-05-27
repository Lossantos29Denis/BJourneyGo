import { Router, Request, Response } from 'express'
import fs from 'fs'
import multer from 'multer'
import path from 'path'
import { createDocument, deleteDocument, getDocumentById, listDocuments, updateDocument } from '../services/adminDocumentsService'
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
  router.post('/documents/upload', requireAuth, requireAdmin, (req: any, res: any, next: any) => {
    console.log('[UPLOAD] Request received:', {
      method: req.method,
      path: req.path,
      url: req.url,
      contentType: req.get('content-type'),
      headers: req.headers,
      isMultipart: req.is('multipart/form-data')
    })
    next()
  }, upload.single('file'), async (req: any, res: Response) => {
    try {
      const file = req.file
      if (!file) {
        console.error('Upload failed: no file in request')
        return res.status(400).json({ error: 'file required' })
      }
      console.log('File uploaded successfully:', { filename: file.filename, size: file.size, path: file.path })
        const fileUrl = `/api/uploads/documents/${file.filename}`
        const fileSize = formatFileSize(file.size)
        res.json({
          success: true,
          fileUrl,
          fileSize,
          originalName: file.originalname,
          filename: file.filename,
          filePath: file.path
        })
    } catch (e: any) {
      console.error('Upload error:', e)
      res.status(500).json({ error: String(e) })
    }
  }, (err: any, req: any, res: Response, next: any) => {
    // Multer error handler
    console.error('Multer middleware error:', err)
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large' })
    }
    if (err.code === 'LIMIT_PART_COUNT') {
      return res.status(400).json({ error: 'Too many parts' })
    }
    res.status(500).json({ error: err.message || 'Upload failed' })
  })

  // GET /admin/documents/files - list physical files in uploads/documents (admin only, for debugging)
  router.get('/documents/files', requireAuth, requireAdmin, async (_req: any, res: Response) => {
    try {
      const files = fs.readdirSync(documentsDir)
      const info = files.map((f) => {
        try {
          const st = fs.statSync(path.join(documentsDir, f))
          return { filename: f, size: st.size, mtime: st.mtime }
        } catch (err) {
          return { filename: f, error: String(err) }
        }
      })
      res.json({ success: true, files: info })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // GET /admin/documents/:id/download
  router.get('/documents/:id/download', requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })

      const doc = await getDocumentById(id)
      if (!doc?.fileUrl) return res.status(404).json({ error: 'file not found' })

      const filename = path.basename(String(doc.fileUrl))
      const filePath = path.join(documentsDir, filename)

      if (!fs.existsSync(filePath)) {
        console.warn('Download requested but file is missing on disk:', { id, filePath })
        return res.status(404).json({ error: 'file not found on server' })
      }

      res.download(filePath, doc.title ? `${doc.title}${path.extname(filename)}` : filename)
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })

  // GET /admin/documents
  router.get('/documents', requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  router.post('/documents', requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  router.put('/documents/:id', requireAuth, requireAdmin, async (req: any, res: Response) => {
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
  router.delete('/documents/:id', requireAuth, requireAdmin, async (req: any, res: Response) => {
    try {
      const id = Number(req.params.id)
      if (!id) return res.status(400).json({ error: 'invalid id' })
      
      // Get document to find file before deleting from DB
      const docs: any = await listDocuments({ category: null, agencyId: null })
      const doc = docs?.find((d: any) => d.id === id)
      
      // Delete document from database
      await deleteDocument(id)
      
      // Delete physical file if it exists
      if (doc?.fileUrl) {
        try {
          const filename = doc.fileUrl.split('/').pop() // Extract filename from URL
          const filePath = path.join(documentsDir, filename)
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath)
            console.log('Document file deleted:', filePath)
          }
        } catch (fileErr: any) {
          console.warn('Warning: Could not delete file from disk:', fileErr.message)
          // Don't fail the API response if file deletion fails
        }
      }
      
      res.json({ success: true })
    } catch (e: any) {
      res.status(500).json({ error: String(e) })
    }
  })
}
