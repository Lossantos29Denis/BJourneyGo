// Verificar autenticación de intranet
const intranetAuth = localStorage.getItem('intranetAuth');
if (intranetAuth !== 'true') {
  location.replace('/intranet-login');
}

// Inicializar sistema de usuarios
const USERS_KEY = 'systemUsers';

// Cargar usuarios del localStorage o crear datos de ejemplo
function loadUsers() {
  const usersJson = localStorage.getItem(USERS_KEY);
  if (usersJson) {
    return JSON.parse(usersJson);
  }
  
  // Usuarios de ejemplo iniciales
  const defaultUsers = [
    {
      id: '1',
      username: 'sergio',
      email: 'sergio@bjourney.com',
      fullName: 'Sergio Admin',
      password: 'Serxgio',
      role: 'admin',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      username: 'maria.lopez',
      email: 'maria.lopez@bjourney.com',
      fullName: 'María López',
      password: 'empleado123',
      role: 'empleado',
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  ];
  
  saveUsers(defaultUsers);
  return defaultUsers;
}

// Guardar usuarios en localStorage
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// Generar ID único
function generateId() {
  return Date.now().toString() + Math.random().toString(36).substr(2, 9);
}

// Renderizar tabla de usuarios
function renderUsers(usersToRender = null) {
  const users = usersToRender || loadUsers();
  const tbody = document.getElementById('usersTableBody');
  const emptyState = document.getElementById('emptyState');
  
  if (users.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }
  
  emptyState.style.display = 'none';
  
  tbody.innerHTML = users.map(user => {
    const initials = user.fullName
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
    
    const date = new Date(user.createdAt).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    const roleIcon = user.role === 'admin' ? '👑' : user.role === 'agency' ? '🏢' : '👤';
    const roleClass = user.role === 'admin' ? 'badge-admin' : user.role === 'agency' ? 'badge-agency' : 'badge-empleado';
    const roleText = user.role === 'admin' ? 'Administrador' : user.role === 'agency' ? 'Agencia' : 'Empleado';
    
    return `
      <tr>
        <td data-label="Usuario">
          <div class="user-info">
            <div class="user-avatar">${initials}</div>
            <div class="user-details">
              <div class="user-name">${user.fullName}</div>
              <div class="user-username">@${user.username}</div>
            </div>
          </div>
        </td>
        <td data-label="Email">${user.email}</td>
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
            <button class="btn-icon edit" data-id="${user.id}" title="Editar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
            </button>
            <button class="btn-icon delete" data-id="${user.id}" title="Eliminar">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
              </svg>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
  
  // Agregar event listeners a los botones
  document.querySelectorAll('.btn-icon.edit').forEach(btn => {
    btn.addEventListener('click', () => editUser(btn.dataset.id));
  });
  
  document.querySelectorAll('.btn-icon.delete').forEach(btn => {
    btn.addEventListener('click', () => showDeleteModal(btn.dataset.id));
  });
}

// Buscar usuarios
function searchUsers(query) {
  const users = loadUsers();
  const filtered = users.filter(user => {
    const searchText = query.toLowerCase();
    return (
      user.username.toLowerCase().includes(searchText) ||
      user.email.toLowerCase().includes(searchText) ||
      user.fullName.toLowerCase().includes(searchText) ||
      user.role.toLowerCase().includes(searchText)
    );
  });
  renderUsers(filtered);
}

// Abrir modal para nuevo usuario
function openNewUserModal() {
  const modal = document.getElementById('userModal');
  const form = document.getElementById('userForm');
  const modalTitle = document.getElementById('modalTitle');
  const passwordHint = document.getElementById('passwordHint');
  const agencyFields = document.getElementById('agencyFields');
  
  modalTitle.textContent = 'Nuevo Usuario';
  passwordHint.style.display = 'none';
  agencyFields.style.display = 'none';
  form.reset();
  document.getElementById('userId').value = '';
  document.getElementById('password').required = true;
  
  modal.classList.add('active');
}

// Editar usuario
function editUser(userId) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) return;
  
  const modal = document.getElementById('userModal');
  const modalTitle = document.getElementById('modalTitle');
  const passwordHint = document.getElementById('passwordHint');
  const agencyFields = document.getElementById('agencyFields');
  
  modalTitle.textContent = 'Editar Usuario';
  passwordHint.style.display = 'block';
  
  document.getElementById('userId').value = user.id;
  document.getElementById('username').value = user.username;
  document.getElementById('email').value = user.email;
  document.getElementById('fullName').value = user.fullName;
  document.getElementById('password').value = '';
  document.getElementById('password').required = false;
  document.getElementById('role').value = user.role;
  
  // Mostrar/ocultar campos de agencia
  if (user.role === 'agency') {
    agencyFields.style.display = 'block';
    document.getElementById('agencyName').value = user.agencyName || '';
    document.getElementById('agencyPhone').value = user.agencyPhone || '';
    document.getElementById('agencyAddress').value = user.agencyAddress || '';
  } else {
    agencyFields.style.display = 'none';
  }
  
  modal.classList.add('active');
}

// Cerrar modal
function closeModal() {
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => modal.classList.remove('active'));
}

// Guardar usuario (crear o actualizar)
function saveUser(event) {
  event.preventDefault();
  
  const userId = document.getElementById('userId').value;
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const fullName = document.getElementById('fullName').value.trim();
  const password = document.getElementById('password').value;
  const role = document.getElementById('role').value;
  
  // Campos de agencia
  const agencyName = document.getElementById('agencyName').value.trim();
  const agencyPhone = document.getElementById('agencyPhone').value.trim();
  const agencyAddress = document.getElementById('agencyAddress').value.trim();
  
  // Validaciones
  if (!username || !email || !fullName || !role) {
    alert('Por favor completa todos los campos obligatorios');
    return;
  }
  
  // Validar campos de agencia si el rol es agency
  if (role === 'agency' && !agencyName) {
    alert('Por favor ingresa el nombre de la agencia');
    return;
  }
  
  if (!userId && !password) {
    alert('La contraseña es obligatoria para nuevos usuarios');
    return;
  }
  
  if (password && password.length < 6) {
    alert('La contraseña debe tener al menos 6 caracteres');
    return;
  }
  
  const users = loadUsers();
  
  // Verificar si el username ya existe (excepto el usuario actual)
  const existingUser = users.find(u => u.username === username && u.id !== userId);
  if (existingUser) {
    alert('Ya existe un usuario con ese nombre de usuario');
    return;
  }
  
  // Generar agencyId único para nuevas agencias
  let agencyId = null;
  if (role === 'agency') {
    if (userId) {
      // Si es edición, mantener el agencyId existente
      const existingUserData = users.find(u => u.id === userId);
      agencyId = existingUserData?.agencyId || `AG${String(Date.now()).slice(-6)}`;
    } else {
      // Si es nuevo, generar un nuevo agencyId
      agencyId = `AG${String(Date.now()).slice(-6)}`;
    }
  }
  
  if (userId) {
    // Actualizar usuario existente
    const index = users.findIndex(u => u.id === userId);
    if (index !== -1) {
      users[index] = {
        ...users[index],
        username,
        email,
        fullName,
        role,
        ...(password && { password }), // Solo actualizar password si se proporciona
        ...(role === 'agency' && {
          agencyId,
          agencyName,
          agencyPhone,
          agencyAddress
        })
      };
    }
  } else {
    // Crear nuevo usuario
    const newUser = {
      id: generateId(),
      username,
      email,
      fullName,
      password,
      role,
      createdAt: new Date().toISOString(),
      ...(role === 'agency' && {
        agencyId,
        agencyName,
        agencyPhone,
        agencyAddress
      })
    };
    users.push(newUser);
  }
  
  saveUsers(users);
  
  // Sincronizar con el archivo users.json para el login
  if (role === 'admin' || role === 'agency') {
    syncUserToDataFile(username, password, role, agencyId, agencyName);
  }
  
  renderUsers();
  closeModal();
  
  // Mostrar mensaje de éxito
  alert(userId ? 'Usuario actualizado correctamente' : 'Usuario creado correctamente');
}

// Sincronizar usuario con el archivo de datos
async function syncUserToDataFile(username, password, role, agencyId, agencyName) {
  try {
    const res = await fetch('/api/sync-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        username, 
        password, 
        role,
        isAdmin: role === 'admin',
        ...(role === 'agency' && { agencyId, agencyName })
      })
    });
    
    if (!res.ok) {
      console.error('Error sincronizando usuario:', await res.text());
    }
  } catch (error) {
    console.error('Error de conexión al sincronizar:', error);
  }
}

// Mostrar modal de confirmación para eliminar
function showDeleteModal(userId) {
  const users = loadUsers();
  const user = users.find(u => u.id === userId);
  
  if (!user) return;
  
  const modal = document.getElementById('deleteModal');
  const userName = document.getElementById('deleteUserName');
  
  userName.textContent = `${user.fullName} (@${user.username})`;
  modal.classList.add('active');
  
  // Guardar el ID en el botón de confirmar
  document.getElementById('confirmDeleteBtn').dataset.userId = userId;
}

// Eliminar usuario
function deleteUser(userId) {
  const users = loadUsers();
  const currentUser = localStorage.getItem('intranetUser');
  const userToDelete = users.find(u => u.id === userId);
  
  // No permitir eliminar el usuario actual
  if (userToDelete && userToDelete.username === currentUser) {
    alert('No puedes eliminar tu propio usuario');
    closeModal();
    return;
  }
  
  const filteredUsers = users.filter(u => u.id !== userId);
  saveUsers(filteredUsers);
  renderUsers();
  closeModal();
  
  alert('Usuario eliminado correctamente');
}

// Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  // Renderizar usuarios iniciales
  renderUsers();
  
  // Buscar usuarios
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    searchUsers(e.target.value);
  });
  
  // Nuevo usuario
  document.getElementById('btnNewUser').addEventListener('click', openNewUserModal);
  
  // Cerrar modales
  document.getElementById('closeModal').addEventListener('click', closeModal);
  document.getElementById('cancelBtn').addEventListener('click', closeModal);
  document.getElementById('cancelDeleteBtn').addEventListener('click', closeModal);
  
  // Cerrar modal al hacer click fuera
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });
  });
  
  // Guardar usuario
  document.getElementById('userForm').addEventListener('submit', saveUser);
  
  // Confirmar eliminación
  document.getElementById('confirmDeleteBtn').addEventListener('click', (e) => {
    const userId = e.target.dataset.userId;
    if (userId) {
      deleteUser(userId);
    }
  });
  
  // Mostrar/ocultar campos de agencia según el rol seleccionado
  document.getElementById('role').addEventListener('change', (e) => {
    const agencyFields = document.getElementById('agencyFields');
    const agencyNameInput = document.getElementById('agencyName');
    
    if (e.target.value === 'agency') {
      agencyFields.style.display = 'block';
      agencyNameInput.required = true;
    } else {
      agencyFields.style.display = 'none';
      agencyNameInput.required = false;
    }
  });
});
