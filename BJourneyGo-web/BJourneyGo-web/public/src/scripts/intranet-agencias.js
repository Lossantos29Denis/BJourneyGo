import { fetchWithAuth } from '/src/scripts/api.js'

const agenciesList = document.getElementById('agenciesList')
const searchInput = document.getElementById('agencySearch')

let agencies = []

async function loadAgencies() {
  try {
    const res = await fetchWithAuth('/api/admin/agencies')
    const json = await res.json()
    agencies = json.agencies || []
    render()
  } catch (e) {
    agenciesList.innerHTML = '<p>Error cargando agencias</p>'
  }
}

function render() {
  const q = (searchInput.value || '').toLowerCase()
  const filtered = agencies.filter(a => a.name.toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q))
  agenciesList.innerHTML = filtered.map(a => `<div class="agency-card"><h3>${a.name}</h3><p>${a.email || ''}</p></div>`).join('')
}

searchInput?.addEventListener('input', render)
loadAgencies()
