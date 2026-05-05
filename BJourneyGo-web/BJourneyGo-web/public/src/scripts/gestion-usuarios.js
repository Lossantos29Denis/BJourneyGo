import { fetchWithAuth } from '/src/scripts/api.js'

const intranetAuth = localStorage.getItem('intranetAuth')
if (intranetAuth !== 'true') {
  location.replace('/intranet-login')
}

const intranetRole = localStorage.getItem('intranetRole')
if (intranetRole === 'agency' || intranetRole === 'scanner') {
  location.replace('/intranet')
}

let usersCache = []

function mapDbRoleToUi(role) {
  if (role === 'ADMIN') return 'admin'
  if (role === 'AGENCY_ADMIN' || role === 'AGENCY_WORKER') return 'agency'
  return 'cliente'
}

function hasScannerPermission(user) {
  return Boolean(user?.scannerEnabled) || (user?.role === 'USER' && Boolean(user?.agencyId) && user?.agencyWorkerRole === 'STAFF')
}

function mapUiRoleToDb(role) {
  if (role === 'admin') return 'ADMIN'
  if (role === 'agency') return 'AGENCY_ADMIN'
  if (role === 'empleado') return 'USER'
  return 'USER'
}

function getDisplayUsername(email) {
  if (!email) return 'usuario'
  return email.split('@')[0]
}

function parseAgencyAddress(address) {
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

async function loadUsers() {
  try {
    const res = await fetchWithAuth('/api/admin/users')
    if (!res.ok) throw new Error('load failed')
    const json = await res.json()
    usersCache = json.users || []
  } catch (e) {
    usersCache = []
  }
  return usersCache
}

function renderUsers(usersToRender = null) {
  const users = usersToRender || usersCache
  const tbody = document.getElementById('usersTableBody')
  const emptyState = document.getElementById('emptyState')

  if (users.length === 0) {
    tbody.innerHTML = ''
    emptyState.style.display = 'block'
    return
  }

  emptyState.style.display = 'none'

  tbody.innerHTML = users.map(user => {
    const displayName = user.name || user.email || 'Usuario'
    const initials = displayName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

    const date = new Date(user.createdAt).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })

    const roleUi = hasScannerPermission(user) ? 'scanner' : mapDbRoleToUi(user.role)
    const roleIcon = roleUi === 'admin' ? '👑' : roleUi === 'agency' ? '🏢' : roleUi === 'scanner' ? '📷' : '👤'
    const roleClass = roleUi === 'admin' ? 'badge-admin' : roleUi === 'agency' ? 'badge-agency' : roleUi === 'scanner' ? 'badge-agency' : 'badge-empleado'
    const roleText = roleUi === 'admin' ? 'Administrador' : roleUi === 'agency' ? 'Agencia' : roleUi === 'scanner' ? 'Cliente + Escáner' : 'Cliente'

    return `
      <tr>
        <td data-label="Usuario">
          <div class="user-info">
            <div class="user-avatar">${initials}</div>
            <div class="user-details">
              <div class="user-name">${displayName}</div>
              <div class="user-username">@${getDisplayUsername(user.email)}</div>
            </div>
          </div>
        </td>
        <td data-label="Email">${user.email || '-'}</td>
        <td data-label="Rol">
          <span class="badge ${roleClass}">
            <span>${roleIcon}</span>
            <span>${roleText}</span>
          </span>
        </td>
        <td data-label="Fecha Creación">
          <span class="date-text">${date}</span>
        </td>
        <td data-label="Acciones">
          <div class="actions-cell">
            <button class="btn-icon edit" data-id="${user.id}" title="Editar">Edit</button>
            <button class="btn-icon delete" data-id="${user.id}" title="Eliminar">Del</button>
          </div>
        </td>
      </tr>
    `
  }).join('')

  document.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.addEventListener('click', () => editUser(btn.dataset.id))
  })

  document.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', () => showDeleteModal(btn.dataset.id))
  })
}

function searchUsers(query) {
  const searchText = query.toLowerCase()
  const filtered = usersCache.filter(user => {
    const name = (user.name || '').toLowerCase()
    const email = (user.email || '').toLowerCase()
    const role = (user.role || '').toLowerCase()
    return name.includes(searchText) || email.includes(searchText) || role.includes(searchText)
  })
  renderUsers(filtered)
}

function openNewUserModal() {
  const modal = document.getElementById('userModal')
  const form = document.getElementById('userForm')
  const modalTitle = document.getElementById('modalTitle')
  const passwordHint = document.getElementById('passwordHint')
  const agencyFields = document.getElementById('agencyFields')
  const roleEl = document.getElementById('role')
  const scannerPermissionEl = document.getElementById('scannerPermission')

  modalTitle.textContent = 'Nuevo Usuario'
  passwordHint.style.display = 'none'
  agencyFields.style.display = 'none'
  form.reset()
  document.getElementById('userId').value = ''
  document.getElementById('password').required = true
  roleEl.value = 'cliente'
  scannerPermissionEl.checked = false
  scannerPermissionEl.disabled = false

  modal.classList.add('active')
}

function editUser(userId) {
  const user = usersCache.find(u => String(u.id) === String(userId))

  if (!user) return

  const modal = document.getElementById('userModal')
  const modalTitle = document.getElementById('modalTitle')
  const passwordHint = document.getElementById('passwordHint')
  const agencyFields = document.getElementById('agencyFields')

  modalTitle.textContent = 'Editar Usuario'
  passwordHint.style.display = 'block'

  document.getElementById('userId').value = user.id
  document.getElementById('username').value = getDisplayUsername(user.email)
  document.getElementById('email').value = user.email || ''
  document.getElementById('fullName').value = user.name || ''
  document.getElementById('password').value = ''
  document.getElementById('password').required = false
  const scannerPermission = hasScannerPermission(user)
  const uiRole = mapDbRoleToUi(user.role)
  document.getElementById('role').value = uiRole
  document.getElementById('scannerPermission').checked = scannerPermission

  if (uiRole === 'agency' || scannerPermission) {
    agencyFields.style.display = 'block'
    document.getElementById('agencyName').value = user.agencyName || ''
    document.getElementById('agencyPhone').value = user.agencyPhone || ''
    document.getElementById('agencyAddress').value = parseAgencyAddress(user.agencyAddress)
  } else {
    agencyFields.style.display = 'none'
  }

  modal.classList.add('active')
}

function closeModal() {
  const modals = document.querySelectorAll('.modal')
  modals.forEach(modal => modal.classList.remove('active'))
}

async function saveUser(event) {
  event.preventDefault()

  const userId = document.getElementById('userId').value
  const email = document.getElementById('email').value.trim()
  const fullName = document.getElementById('fullName').value.trim()
  const password = document.getElementById('password').value
  const role = document.getElementById('role').value
  const scannerPermission = document.getElementById('scannerPermission').checked

  const agencyName = document.getElementById('agencyName').value.trim()
  const agencyPhone = document.getElementById('agencyPhone').value.trim()
  const agencyAddress = document.getElementById('agencyAddress').value.trim()

  if (!email || !fullName || !role) {
    alert('Por favor completa todos los campos obligatorios')
    return
  }

  if ((role === 'agency' || scannerPermission) && !agencyName) {
    alert('Por favor ingresa el nombre de la agencia')
    return
  }

  if (!userId && !password) {
    alert('La contraseña es obligatoria para nuevos usuarios')
    return
  }

  if (password && password.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres')
    return
  }

  const payload = {
    id: userId || undefined,
    email,
    name: fullName,
    role: scannerPermission && role === 'cliente' ? 'SCANNER' : mapUiRoleToDb(role)
  }

  if (password) payload.password = password

  if (role === 'agency' || scannerPermission) {
    payload.agencyName = agencyName
    payload.agencyPhone = agencyPhone || undefined
    payload.agencyAddress = agencyAddress || undefined
  }

  try {
    const res = await fetchWithAuth('/api/admin/users', {
      method: userId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    if (!res.ok) throw new Error(await res.text())
    await loadUsers()
    renderUsers()
    closeModal()
    alert(userId ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente')
  } catch (e) {
    alert('No se pudo guardar el usuario')
  }
}

function showDeleteModal(userId) {
  const user = usersCache.find(u => String(u.id) === String(userId))

  if (!user) return

  const modal = document.getElementById('deleteModal')
  const userName = document.getElementById('deleteUserName')

  userName.textContent = `${user.name || user.email} (@${getDisplayUsername(user.email)})`
  modal.classList.add('active')

  document.getElementById('confirmDeleteBtn').dataset.userId = userId
}

async function deleteUser(userId) {
  try {
    const res = await fetchWithAuth('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: userId })
    })
    if (!res.ok) throw new Error(await res.text())
    await loadUsers()
    renderUsers()
    closeModal()
    alert('Usuario eliminado correctamente')
  } catch (e) {
    alert('No se pudo eliminar el usuario')
    closeModal()
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  await loadUsers()
  renderUsers()

  const searchInput = document.getElementById('searchInput')
  searchInput.addEventListener('input', (e) => {
    searchUsers(e.target.value)
  })

  document.getElementById('btnNewUser').addEventListener('click', openNewUserModal)

  document.getElementById('closeModal').addEventListener('click', closeModal)
  document.getElementById('cancelBtn').addEventListener('click', closeModal)
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeModal)

  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal()
      }
    })
  })

  document.getElementById('userForm').addEventListener('submit', saveUser)

  document.getElementById('confirmDeleteBtn').addEventListener('click', (e) => {
    const userId = e.target.dataset.userId
    if (userId) {
      deleteUser(userId)
    }
  })

  function syncAgencyFieldsVisibility() {
    const agencyFields = document.getElementById('agencyFields')
    const agencyNameInput = document.getElementById('agencyName')
    const role = document.getElementById('role').value
    const scannerPermissionEl = document.getElementById('scannerPermission')
    const scannerAllowed = role === 'cliente' || role === ''
    scannerPermissionEl.disabled = !scannerAllowed
    if (!scannerAllowed && scannerPermissionEl.checked) scannerPermissionEl.checked = false
    const scannerPermission = scannerPermissionEl.checked

    if (role === 'agency' || scannerPermission) {
      agencyFields.style.display = 'block'
      agencyNameInput.required = true
    } else {
      agencyFields.style.display = 'none'
      agencyNameInput.required = false
    }
  }

  document.getElementById('role').addEventListener('change', syncAgencyFieldsVisibility)
  document.getElementById('scannerPermission').addEventListener('change', syncAgencyFieldsVisibility)
  syncAgencyFieldsVisibility()
})
