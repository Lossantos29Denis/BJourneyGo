import { fetchWithAuth } from '/src/scripts/api.js'

const intranetAuth = localStorage.getItem('intranetAuth')
if (intranetAuth !== 'true') {
  location.replace('/intranet-login')
} else if (localStorage.getItem('intranetRole') === 'agency') {
  location.replace('/intranet')
}

let agenciesCache = []

function parseAddress(address) {
  if (!address) return ''
  if (typeof address === 'string') {
    try {
      const parsed = JSON.parse(address)
      return parsed?.line1 || parsed?.address || ''
    } catch (e) {
      return address
    }
  }
  return address.line1 || address.address || ''
}

function normalizeCommissionPercent(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return null
  if (parsed < 0 || parsed > 100) return null
  return parsed
}

async function loadAgencies() {
  try {
    const res = await fetchWithAuth('/api/admin/agencies')
    if (!res.ok) throw new Error('load failed')
    const json = await res.json()
    agenciesCache = json.agencies || []
  } catch (e) {
    agenciesCache = []
  }
  return agenciesCache
}

function renderAgencies(list = null) {
  const agencies = list || agenciesCache
  const tbody = document.getElementById('agenciesTableBody')
  const emptyState = document.getElementById('emptyState')

  if (!agencies.length) {
    tbody.innerHTML = ''
    emptyState.style.display = 'block'
    return
  }

  emptyState.style.display = 'none'
  tbody.innerHTML = agencies.map(agency => {
    const status = String(agency.status || 'ACTIVE')
    const badgeClass = status === 'ACTIVE' ? 'active' : 'inactive'
    return `
      <tr>
        <td><strong>${agency.name || '-'}</strong></td>
        <td>${agency.contactEmail || '-'}</td>
        <td>${agency.phone || '-'}</td>
        <td>${agency.stripeAccountId || '-'}</td>
        <td>${agency.commissionPercent ?? 10}</td>
        <td>${agency.payoutActive ? 'Si' : 'No'}</td>
        <td><span class="status-badge ${badgeClass}">${status === 'ACTIVE' ? 'Activa' : 'Inactiva'}</span></td>
        <td>
          <div class="actions-cell">
            <button class="btn-icon edit" data-id="${agency.id}" title="Editar">Edit</button>
            <button class="btn-icon delete" data-id="${agency.id}" title="Eliminar">Del</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  tbody.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  })
  tbody.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', () => showDeleteModal(btn.dataset.id))
  })
}

function searchAgencies(query) {
  const text = query.toLowerCase()
  const filtered = agenciesCache.filter(agency => {
    return (
      (agency.name || '').toLowerCase().includes(text) ||
      (agency.contactEmail || '').toLowerCase().includes(text) ||
      (agency.phone || '').toLowerCase().includes(text) ||
      (agency.taxId || '').toLowerCase().includes(text) ||
      (agency.stripeAccountId || '').toLowerCase().includes(text)
    )
  })
  renderAgencies(filtered)
}

function openNewModal() {
  const modal = document.getElementById('agencyModal')
  const form = document.getElementById('agencyForm')
  document.getElementById('modalTitle').textContent = 'Nueva Agencia'
  form.reset()
  document.getElementById('agencyId').value = ''
  modal.classList.add('active')
}

function openEditModal(id) {
  const agency = agenciesCache.find(item => String(item.id) === String(id))
  if (!agency) return
  const modal = document.getElementById('agencyModal')
  document.getElementById('modalTitle').textContent = 'Editar Agencia'
  document.getElementById('agencyId').value = agency.id
  document.getElementById('agencyName').value = agency.name || ''
  document.getElementById('agencyEmail').value = agency.contactEmail || ''
  document.getElementById('agencyPhone').value = agency.phone || ''
  document.getElementById('agencyTaxId').value = agency.taxId || ''
  document.getElementById('agencyStripe').value = agency.stripeAccountId || ''
  document.getElementById('agencyCommission').value = agency.commissionPercent ?? 10
  document.getElementById('agencyPayout').value = agency.payoutActive ? 'true' : 'false'
  document.getElementById('agencyStatus').value = agency.status || 'ACTIVE'
  document.getElementById('agencyAddress').value = parseAddress(agency.address)
  modal.classList.add('active')
}

function closeModal() {
  document.querySelectorAll('.modal').forEach(modal => modal.classList.remove('active'))
}

async function saveAgency(event) {
  event.preventDefault()
  const agencyId = document.getElementById('agencyId').value
  const name = document.getElementById('agencyName').value.trim()
  const contactEmail = document.getElementById('agencyEmail').value.trim()
  const phone = document.getElementById('agencyPhone').value.trim()
  const taxId = document.getElementById('agencyTaxId').value.trim()
  const stripeAccountId = document.getElementById('agencyStripe').value.trim()
  const commissionInput = document.getElementById('agencyCommission').value
  const commissionPercent = normalizeCommissionPercent(commissionInput, 10)
  const payoutActive = document.getElementById('agencyPayout').value === 'true'
  const status = document.getElementById('agencyStatus').value
  const address = document.getElementById('agencyAddress').value.trim()

  if (!name) {
    alert('El nombre es obligatorio')
    return
  }

  if (commissionPercent === null) {
    alert('La comision debe estar entre 0 y 100')
    return
  }

  const payload = {
    id: agencyId || undefined,
    name,
    contactEmail: contactEmail || undefined,
    phone: phone || undefined,
    taxId: taxId || undefined,
    stripeAccountId: stripeAccountId || undefined,
    commissionPercent,
    payoutActive,
    status,
    address: address || undefined
  }

  try {
    const res = await fetchWithAuth('/api/admin/agencies', {
      method: agencyId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error('save failed')
    await loadAgencies()
    renderAgencies()
    closeModal()
    alert(agencyId ? 'Agencia actualizada' : 'Agencia creada')
  } catch (e) {
    alert('No se pudo guardar la agencia')
  }
}

function showDeleteModal(id) {
  const agency = agenciesCache.find(item => String(item.id) === String(id))
  if (!agency) return
  document.getElementById('deleteAgencyName').textContent = agency.name || ''
  document.getElementById('confirmDeleteBtn').dataset.agencyId = id
  document.getElementById('deleteModal').classList.add('active')
}

async function deleteAgency(id) {
  try {
    const res = await fetchWithAuth('/api/admin/agencies', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (!res.ok) throw new Error('delete failed')
    await loadAgencies()
    renderAgencies()
    closeModal()
    alert('Agencia eliminada')
  } catch (e) {
    alert('No se pudo eliminar la agencia')
    closeModal()
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadAgencies()
  renderAgencies()

  document.getElementById('btnNewAgency').addEventListener('click', openNewModal)
  document.getElementById('closeModal').addEventListener('click', closeModal)
  document.getElementById('cancelBtn').addEventListener('click', closeModal)
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeModal)

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal()
    })
  })

  document.getElementById('agencyForm').addEventListener('submit', saveAgency)
  document.getElementById('confirmDeleteBtn').addEventListener('click', (e) => {
    const id = e.target.dataset.agencyId
    if (id) deleteAgency(id)
  })

  document.getElementById('searchInput').addEventListener('input', (e) => {
    searchAgencies(e.target.value)
  })
})
