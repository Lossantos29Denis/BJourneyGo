import { fetchWithAuth } from '/src/scripts/api.js'

const statsContainer = document.getElementById('statsContainer')
const summaryContainer = document.getElementById('summaryContainer')

async function loadStats() {
  try {
    const res = await fetchWithAuth('/api/admin/stats')
    if (!res.ok) throw new Error('stats load failed')
    const json = await res.json()
    renderStats(json)
  } catch (e) {
    statsContainer.innerHTML = '<p>Error cargando estadisticas</p>'
  }
}

function renderStats(data) {
  statsContainer.innerHTML = `
    <div class="stat">Usuarios: ${data.usersCount || 0}</div>
    <div class="stat">Reservas: ${data.reservationsCount || 0}</div>
    <div class="stat">Ingresos: ${data.revenue || 0}</div>
  `
  summaryContainer.innerHTML = `<pre>${JSON.stringify(data.summary || {}, null, 2)}</pre>`
}

loadStats()
