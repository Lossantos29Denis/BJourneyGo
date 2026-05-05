import { fetchWithAuth } from '/src/scripts/api.js'

const role = localStorage.getItem('intranetRole') || 'admin'
if (role === 'agency') {
  document.querySelector('.page-hero h1').textContent = 'Configuracion de Agencia'
  document.querySelector('.lead').textContent = 'Panel de configuracion con parametros generales y notificaciones.'
}

const btnGeneralConfig = document.getElementById('btnGeneralConfig')
const btnDatabaseConfig = document.getElementById('btnDatabaseConfig')
const btnSecurityConfig = document.getElementById('btnSecurityConfig')
const btnNotificationsConfig = document.getElementById('btnNotificationsConfig')
const btnIntegrationsConfig = document.getElementById('btnIntegrationsConfig')
const btnLogsConfig = document.getElementById('btnLogsConfig')

const configModal = document.getElementById('configModal')
const modalTitle = document.getElementById('modalTitle')
const modalBody = document.getElementById('modalBody')
const closeConfigModal = document.getElementById('closeConfigModal')

let currentConfig = {}

async function loadSystemStatus() {
  document.getElementById('systemVersion').textContent = 'v1.2.0'
  document.getElementById('activeUsers').textContent = currentConfig.activeUsers || '--'
  const now = new Date()
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  document.getElementById('lastUpdate').textContent = now.toLocaleDateString('es-ES', options)
}

async function loadConfig() {
  if (role === 'agency') {
    currentConfig = {}
    return
  }
  try {
    const res = await fetchWithAuth('/api/admin/config')
    if (!res.ok) throw new Error('load config failed')
    const json = await res.json()
    currentConfig = json.config || {}
  } catch (e) {
    currentConfig = {}
  }
}

async function saveConfig(payload) {
  if (role === 'agency') {
    alert('Solo administradores pueden guardar configuracion')
    return false
  }
  try {
    const res = await fetchWithAuth('/api/admin/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ configs: payload })
    })
    if (!res.ok) throw new Error('save config failed')
    await loadConfig()
    return true
  } catch (e) {
    alert('No se pudo guardar la configuracion')
    return false
  }
}

// Funciones de configuración
function openGeneralConfig() {
  modalTitle.textContent = 'Configuración General';
  modalBody.innerHTML = `
    <form id="generalConfigForm">
      <div class="form-group">
        <label for="sysName">Nombre del Sistema</label>
        <input type="text" id="sysName" name="sysName" value="${currentConfig.systemName || 'BJourneyGo'}" class="form-control">
      </div>
      <div class="form-group">
        <label for="sysTimezone">Zona Horaria</label>
        <select id="sysTimezone" name="sysTimezone" class="form-control">
          <option value="UTC">UTC</option>
          <option value="Europe/Madrid" ${currentConfig.timezone === 'Europe/Madrid' ? 'selected' : ''}>Europe/Madrid</option>
          <option value="Europe/Barcelona" ${currentConfig.timezone === 'Europe/Barcelona' ? 'selected' : ''}>Europe/Barcelona</option>
        </select>
      </div>
      <div class="form-group">
        <label for="sysLanguage">Idioma</label>
        <select id="sysLanguage" name="sysLanguage" class="form-control">
          <option value="es" ${currentConfig.language === 'es' ? 'selected' : ''}>Español</option>
          <option value="en" ${currentConfig.language === 'en' ? 'selected' : ''}>English</option>
          <option value="ca" ${currentConfig.language === 'ca' ? 'selected' : ''}>Català</option>
        </select>
      </div>
      <button type="submit" class="btn btn-primary">Guardar Cambios</button>
    </form>
    <style>
      .form-group { margin-bottom: 1.25rem; }
      .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text); }
      .form-control { width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
      .form-control:focus { outline: none; border-color: var(--accent-1); }
    </style>
  `;
  configModal.classList.add('active');

  document.getElementById('generalConfigForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const payload = {
      systemName: document.getElementById('sysName').value,
      timezone: document.getElementById('sysTimezone').value,
      language: document.getElementById('sysLanguage').value
    }
    const ok = await saveConfig(payload)
    if (ok) configModal.classList.remove('active')
  })
}

function openDatabaseConfig() {
  modalTitle.textContent = 'Gestión de Base de Datos';
  modalBody.innerHTML = `
    <div class="db-options">
      <button class="btn btn-primary" style="width: 100%; margin-bottom: 0.75rem;">Hacer Copia de Seguridad</button>
      <button class="btn btn-primary" style="width: 100%; margin-bottom: 0.75rem;">Restaurar Copia</button>
      <button class="btn btn-primary" style="width: 100%; margin-bottom: 0.75rem;">Optimizar Base de Datos</button>
      <button class="btn btn-ghost" style="width: 100%;">Verificar Integridad</button>
    </div>
  `;
  configModal.classList.add('active');
}

function openSecurityConfig() {
  modalTitle.textContent = 'Seguridad y Permisos';
  modalBody.innerHTML = `
    <form id="securityForm">
      <div class="form-group">
        <label for="maxLoginAttempts">Intentos de Login Máximos</label>
        <input type="number" id="maxLoginAttempts" value="${currentConfig.maxLoginAttempts || 5}" min="1" max="20" class="form-control">
      </div>
      <div class="form-group">
        <label for="sessionTimeout">Timeout de Sesión (minutos)</label>
        <input type="number" id="sessionTimeout" value="${currentConfig.sessionTimeout || 30}" min="5" max="240" class="form-control">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="require2fa" ${currentConfig.require2fa ? 'checked' : ''}> Requerir 2FA para Administradores
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="enableTls" ${currentConfig.enableTls ? 'checked' : ''}> Encriptación SSL/TLS
        </label>
      </div>
      <button type="submit" class="btn btn-primary">Guardar Cambios</button>
    </form>
    <style>
      .form-group { margin-bottom: 1.25rem; }
      .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text); }
      .form-control { width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
      .form-group input[type="checkbox"] { margin-right: 0.5rem; }
    </style>
  `;
  configModal.classList.add('active');

  document.getElementById('securityForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const payload = {
      maxLoginAttempts: Number(document.getElementById('maxLoginAttempts').value || 5),
      sessionTimeout: Number(document.getElementById('sessionTimeout').value || 30),
      require2fa: document.getElementById('require2fa').checked,
      enableTls: document.getElementById('enableTls').checked
    }
    const ok = await saveConfig(payload)
    if (ok) configModal.classList.remove('active')
  })
}

function openNotificationsConfig() {
  modalTitle.textContent = 'Notificaciones';
  modalBody.innerHTML = `
    <form id="notificationsForm">
      <div class="form-group">
        <label>
          <input type="checkbox" id="notifyEmail" ${currentConfig.notifyEmail ? 'checked' : ''}> Notificaciones por Email
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="notifyAlerts" ${currentConfig.notifyAlerts ? 'checked' : ''}> Alertas de Sistema
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" id="notifySms" ${currentConfig.notifySms ? 'checked' : ''}> Notificaciones por SMS
        </label>
      </div>
      <div class="form-group">
        <label for="notifEmail">Email de Notificaciones</label>
        <input type="email" id="notifEmail" value="${currentConfig.notifyEmailAddress || ''}" placeholder="admin@bjourney.com" class="form-control">
      </div>
      <button type="submit" class="btn btn-primary">Guardar Cambios</button>
    </form>
    <style>
      .form-group { margin-bottom: 1.25rem; }
      .form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; color: var(--text); }
      .form-control { width: 100%; padding: 0.75rem; border: 1px solid var(--border); border-radius: 6px; background: var(--bg); color: var(--text); }
      .form-group input[type="checkbox"] { margin-right: 0.5rem; }
    </style>
  `;
  configModal.classList.add('active');

  document.getElementById('notificationsForm').addEventListener('submit', async (event) => {
    event.preventDefault()
    const payload = {
      notifyEmail: document.getElementById('notifyEmail').checked,
      notifyAlerts: document.getElementById('notifyAlerts').checked,
      notifySms: document.getElementById('notifySms').checked,
      notifyEmailAddress: document.getElementById('notifEmail').value.trim()
    }
    const ok = await saveConfig(payload)
    if (ok) configModal.classList.remove('active')
  })
}

function openIntegrationsConfig() {
  modalTitle.textContent = 'Integraciones';
  modalBody.innerHTML = `
    <div class="integrations-list">
      <div class="integration-item">
        <h4>Google Maps</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">Para geolocalización de rutas</p>
        <button class="btn btn-primary" style="width: 100%;">Configurar</button>
      </div>
      <div class="integration-item" style="border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1rem;">
        <h4>Stripe</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">Para procesamiento de pagos</p>
        <button class="btn btn-primary" style="width: 100%;">Configurar</button>
      </div>
      <div class="integration-item" style="border-top: 1px solid var(--border); padding-top: 1rem; margin-top: 1rem;">
        <h4>SendGrid</h4>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin: 0.5rem 0;">Para envío de emails</p>
        <button class="btn btn-primary" style="width: 100%;">Configurar</button>
      </div>
    </div>
  `;
  configModal.classList.add('active');
}

function openLogsConfig() {
  modalTitle.textContent = 'Reportes y Logs';
  modalBody.innerHTML = `
    <div class="logs-viewer">
      <div style="background: var(--bg); border-radius: 6px; padding: 1rem; font-family: monospace; font-size: 0.85rem; color: #10b981; max-height: 300px; overflow-y: auto;">
        <div>[2026-01-13 16:35:45] Usuario 'enric' inició sesión</div>
        <div>[2026-01-13 16:35:40] Sistema iniciado correctamente</div>
        <div>[2026-01-13 16:35:35] Carga de configuración completada</div>
        <div>[2026-01-13 16:35:30] Base de datos verificada</div>
        <div>[2026-01-13 16:35:25] Servicio de sesiones iniciado</div>
      </div>
      <button class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Descargar Logs</button>
      <button class="btn btn-ghost" style="width: 100%; margin-top: 0.5rem;">Limpiar Logs</button>
    </div>
  `;
  configModal.classList.add('active');
}

// Event Listeners
btnGeneralConfig?.addEventListener('click', openGeneralConfig)
btnDatabaseConfig?.addEventListener('click', openDatabaseConfig)
btnSecurityConfig?.addEventListener('click', openSecurityConfig)
btnNotificationsConfig?.addEventListener('click', openNotificationsConfig)
btnIntegrationsConfig?.addEventListener('click', openIntegrationsConfig)
btnLogsConfig?.addEventListener('click', openLogsConfig)

closeConfigModal?.addEventListener('click', () => {
  configModal.classList.remove('active')
})

configModal?.addEventListener('click', (e) => {
  if (e.target === configModal) {
    configModal.classList.remove('active')
  }
})

Promise.all([loadConfig()]).then(() => {
  loadSystemStatus()
})
