const searchInput = document.getElementById('searchInput')
const filterButtons = document.querySelectorAll('.filter-btn')
const documentsContainer = document.getElementById('documentsContainer')

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
          ${doc.fileUrl ? `<a class="btn btn-primary doc-btn" href="${doc.fileUrl}" target="_blank" rel="noopener">Descargar</a>` : '<button class="btn btn-primary doc-btn" disabled>Sin archivo</button>'}
        </div>
      `
    }).join('')
  })

  if (documentsContainer) documentsContainer.style.display = 'block'
}

async function loadDocuments() {
  try {
    const res = await fetch('/api/documents')
    if (!res.ok) throw new Error('load failed')
    const json = await res.json()
    documents = json.documents || []
  } catch (e) {
    documents = []
  }
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

filterButtons.forEach(button => {
  button.addEventListener('click', () => {
    filterButtons.forEach(btn => btn.classList.remove('active'))
    button.classList.add('active')
    currentFilter = button.getAttribute('data-filter')
    applyFilters()
  })
})

searchInput?.addEventListener('input', () => applyFilters())

loadDocuments()
