import { query } from '../../../lib/db';

export async function listDocuments(input: { category?: string | null; agencyId?: number | null }) {
  const { category, agencyId } = input
  const where: string[] = []
  const params: any[] = []
  if (category) {
    where.push('category = ?')
    params.push(category)
  }
  if (agencyId) {
    where.push('(agency_id IS NULL OR agency_id = ?)')
    params.push(agencyId)
  }
  const clause = where.length ? 'WHERE ' + where.join(' AND ') : ''
  return query(
    `SELECT id, agency_id AS agencyId, title, category, description, file_url AS fileUrl, file_size AS fileSize, created_at AS createdAt, updated_at AS updatedAt
     FROM \`Document\` ${clause} ORDER BY updated_at DESC`,
    params
  )
}

export async function createDocument(input: {
  title: string
  category?: string | null
  description?: string | null
  fileUrl?: string | null
  fileSize?: string | null
  agencyId?: number | null
}) {
  const { title, category, description, fileUrl, fileSize, agencyId } = input
  const result: any = await query(
    'INSERT INTO `Document` (agency_id, title, category, description, file_url, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())',
    [agencyId || null, title, category || 'RECURSOS', description || null, fileUrl || null, fileSize || null]
  )
  return result?.insertId
}

export async function updateDocument(input: {
  id: number
  title?: string | null
  category?: string | null
  description?: string | null
  fileUrl?: string | null
  fileSize?: string | null
  agencyId?: number | null
}) {
  const { id, title, category, description, fileUrl, fileSize, agencyId } = input
  await query(
    'UPDATE `Document` SET agency_id = COALESCE(?, agency_id), title = COALESCE(?, title), category = COALESCE(?, category), description = COALESCE(?, description), file_url = COALESCE(?, file_url), file_size = COALESCE(?, file_size), updated_at = NOW() WHERE id = ?',
    [agencyId || null, title || null, category || null, description || null, fileUrl || null, fileSize || null, id]
  )
}

export async function deleteDocument(id: number) {
  await query('DELETE FROM `Document` WHERE id = ?', [id])
}
