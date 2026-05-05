import { fetchWithAuth } from '/src/scripts/api.js'

const searchInput = document.getElementById('searchInput')
const filterButtons = document.querySelectorAll('.filter-btn')
const documentsContainer = document.getElementById('documentsContainer')
const adminActions = document.getElementById('adminActions')
const createDocBtn = document.getElementById('createDocBtn')
const documentModal = document.getElementById('documentModal')
const closeDocumentModal = document.getElementById('closeDocumentModal')
const cancelDocumentBtn = document.getElementById('cancelDocumentBtn')
const documentForm = document.getElementById('documentForm')
const statTotal = document.getElementById('statTotal')
const statPoliticas = document.getElementById('statPoliticas')
const statManuales = document.getElementById('statManuales')
const statRecursos = document.getElementById('statRecursos')

const role = localStorage.getItem('intranetRole') || 'admin'
if (role !== 'agency') {
  adminActions.style.display = 'flex'
}

let documents = []
let currentFilter = 'todos'

function formatDate(value) {
  if (!value) return '-'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '-'
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mapCategory(category) {
  if (category === 'POLITICAS') return 'politicas'
  if (category === 'MANUALES') return 'manuales'
  return 'recursos'
}

function getDownloadUrl(fileUrl) {
  const raw = String(fileUrl || '').trim()
  if (!raw) return ''
  if (raw.startsWith('/uploads/')) return `/api${raw}`
  if (raw.startsWith('uploads/')) return `/api/${raw}`

  const bareFileName = /^[^/\\]+\.[a-zA-Z0-9]{2,10}$/.test(raw)
  if (bareFileName) return `/api/uploads/documents/${raw}`

  try {
    const parsed = new URL(raw, window.location.origin)
    const idx = parsed.pathname.indexOf('/uploads/')
    if (idx >= 0) {
      const uploadPath = parsed.pathname.slice(idx)
      return `/api${uploadPath}`
    }
    if (parsed.pathname.startsWith('/documents/')) {
      return `/api/uploads${parsed.pathname}`
    }
  } catch (_e) {
    // fallback to raw below
  }
  if (raw.includes('/uploads/')) {
    const idx = raw.indexOf('/uploads/')
    return `/api${raw.slice(idx)}`
  }
  return raw
}

function renderDocuments(list) {
  const grouped = { politicas: [], manuales: [], recursos: [] }
  list.forEach(doc => {
    grouped[mapCategory(doc.category)]?.push(doc)
  })

  const sections = {
    politicas: document.getElementById('docsPoliticas'),
    manuales: document.getElementById('docsManuales'),
    recursos: document.getElementById('docsRecursos')
  }

  Object.keys(sections).forEach(key => {
    const target = sections[key]
    const items = grouped[key]
    if (!items.length) {
      target.innerHTML = '<div class="document-card"><p>No hay documentos</p></div>'
      return
    }
    target.innerHTML = items.map(doc => {
      const actions = role !== 'agency'
        ? `
          <div class="document-actions">
            <button class="btn btn-secondary" data-edit="${doc.id}">Editar</button>
            <button class="btn btn-ghost" data-delete="${doc.id}">Eliminar</button>
          </div>`
        : ''
      return `
        <div class="document-card">
          <div class="doc-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
            </svg>
          </div>
          <h3>${doc.title}</h3>
          <p>${doc.description || 'Sin descripcion'}</p>
          <div class="doc-meta">
            <span class="doc-date">Actualizado: ${formatDate(doc.updatedAt)}</span>
            <span class="doc-size">${doc.fileSize || '-'}</span>
          </div>
          ${doc.fileUrl ? `<a class="btn btn-primary doc-btn" href="${getDownloadUrl(doc.fileUrl)}" target="_blank" rel="noopener" download>Descargar</a>` : '<button class="btn btn-primary doc-btn" disabled>Sin archivo</button>'}
          ${actions}
        </div>
      `
    }).join('')
  })

  documentsContainer.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.edit))
  })
  documentsContainer.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteDocument(btn.dataset.delete))
  })
}

function updateStats(list) {
  const total = list.length
  const counts = { politicas: 0, manuales: 0, recursos: 0 }
  list.forEach(doc => {
    const key = mapCategory(doc.category)
    if (counts[key] !== undefined) counts[key] += 1
  })
  if (statTotal) statTotal.textContent = String(total)
  if (statPoliticas) statPoliticas.textContent = String(counts.politicas)
  if (statManuales) statManuales.textContent = String(counts.manuales)
  if (statRecursos) statRecursos.textContent = String(counts.recursos)
}

async function loadDocuments() {
  try {
    const res = await fetchWithAuth('/api/admin/documents')
    if (!res.ok) throw new Error('load failed')
    const json = await res.json()
    documents = json.documents || []
  } catch (e) {
    documents = []
  }
  updateStats(documents)
  applyFilters()
}

function applyFilters() {
  const query = (searchInput.value || '').toLowerCase()
  const filtered = documents.filter(doc => {
    const matchesFilter = currentFilter === 'todos' || mapCategory(doc.category) === currentFilter
    const matchesQuery = !query || (doc.title || '').toLowerCase().includes(query) || (doc.description || '').toLowerCase().includes(query)
    return matchesFilter && matchesQuery
  })
  renderDocuments(filtered)
}

function openNewModal() {
  document.getElementById('documentModalTitle').textContent = 'Nuevo documento'
  documentForm.reset()
  document.getElementById('documentId').value = ''
  documentModal.classList.add('active')
}

function openEditModal(id) {
  const doc = documents.find(item => String(item.id) === String(id))
  if (!doc) return
  document.getElementById('documentModalTitle').textContent = 'Editar documento'
  document.getElementById('documentId').value = doc.id
  document.getElementById('documentTitle').value = doc.title || ''
  document.getElementById('documentCategory').value = doc.category || 'RECURSOS'
  document.getElementById('documentSize').value = doc.fileSize || ''
  const fileInput = document.getElementById('documentFile')
  if (fileInput) fileInput.value = ''
  document.getElementById('documentDescription').value = doc.description || ''
  documentModal.classList.add('active')
}

function closeModal() {
  documentModal.classList.remove('active')
}

async function saveDocument(event) {
  event.preventDefault()
  const id = document.getElementById('documentId').value
  const existing = id ? documents.find(item => String(item.id) === String(id)) : null
  const payload = {
    id: id || undefined,
    title: document.getElementById('documentTitle').value.trim(),
    category: document.getElementById('documentCategory').value,
    fileUrl: existing?.fileUrl,
    fileSize: existing?.fileSize,
    description: document.getElementById('documentDescription').value.trim() || undefined
  }
  if (!payload.title) {
    alert('El titulo es obligatorio')
    return
  }
  try {
    const fileInput = document.getElementById('documentFile')
    const file = fileInput?.files?.[0]
    if (file) {
      const formData = new FormData()
      formData.append('file', file)
      const uploadRes = await fetchWithAuth('/api/admin/documents/upload', {
        method: 'POST',
        body: formData
      })
      if (!uploadRes.ok) throw new Error('upload failed')
      const uploadJson = await uploadRes.json()
      payload.fileUrl = String(uploadJson.fileUrl || '').trim()
      payload.fileSize = uploadJson.fileSize
      document.getElementById('documentSize').value = uploadJson.fileSize || ''
    }
    const res = await fetchWithAuth(id ? `/api/admin/documents/${id}` : '/api/admin/documents', {
      method: id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('save failed')
    await loadDocuments()
    closeModal()
  } catch (e) {
    alert('No se pudo guardar el documento')
  }
}

async function deleteDocument(id) {
  if (!confirm('¿Eliminar documento?')) return
  try {
    const res = await fetchWithAuth(`/api/admin/documents/${id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (!res.ok) throw new Error('delete failed')
    await loadDocuments()
  } catch (e) {
    alert('No se pudo eliminar el documento')
  }
}

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    filterButtons.forEach(btn => btn.classList.remove('active'))
    button.classList.add('active')
    currentFilter = button.getAttribute('data-filter')
    applyFilters()
  })
})

searchInput?.addEventListener('input', () => applyFilters())
createDocBtn?.addEventListener('click', openNewModal)
closeDocumentModal?.addEventListener('click', closeModal)
cancelDocumentBtn?.addEventListener('click', closeModal)
documentModal?.addEventListener('click', (e) => { if (e.target === documentModal) closeModal() })
documentForm?.addEventListener('submit', saveDocument)

loadDocuments()
