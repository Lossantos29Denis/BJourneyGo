// Configuración del Sistema - Script

// Elementos del DOM
const btnGeneralConfig = document.getElementById('btnGeneralConfig');
const btnDatabaseConfig = document.getElementById('btnDatabaseConfig');
const btnSecurityConfig = document.getElementById('btnSecurityConfig');
const btnNotificationsConfig = document.getElementById('btnNotificationsConfig');
const btnIntegrationsConfig = document.getElementById('btnIntegrationsConfig');
const btnLogsConfig = document.getElementById('btnLogsConfig');

const configModal = document.getElementById('configModal');
const modalTitle = document.getElementById('modalTitle');
const modalBody = document.getElementById('modalBody');
const closeConfigModal = document.getElementById('closeConfigModal');

// Cargar datos del sistema
function loadSystemStatus() {
  // Versión del sistema
  document.getElementById('systemVersion').textContent = 'v1.2.0';
  
  // Usuarios activos (simulado)
  document.getElementById('activeUsers').textContent = '5';
  
  // Última actualización
  const now = new Date();
  const options = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  document.getElementById('lastUpdate').textContent = now.toLocaleDateString('es-ES', options);
}

// Funciones de configuración
function openGeneralConfig() {
  modalTitle.textContent = 'Configuración General';
  modalBody.innerHTML = `
    <form id="generalConfigForm">
      <div class="form-group">
        <label for="sysName">Nombre del Sistema</label>
        <input type="text" id="sysName" name="sysName" value="BJourneyGo" class="form-control">
      </div>
      <div class="form-group">
        <label for="sysTimezone">Zona Horaria</label>
        <select id="sysTimezone" name="sysTimezone" class="form-control">
          <option value="UTC">UTC</option>
          <option value="Europe/Madrid" selected>Europe/Madrid</option>
          <option value="Europe/Barcelona">Europe/Barcelona</option>
        </select>
      </div>
      <div class="form-group">
        <label for="sysLanguage">Idioma</label>
        <select id="sysLanguage" name="sysLanguage" class="form-control">
          <option value="es" selected>Español</option>
          <option value="en">English</option>
          <option value="ca">Català</option>
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
        <input type="number" id="maxLoginAttempts" value="5" min="1" max="20" class="form-control">
      </div>
      <div class="form-group">
        <label for="sessionTimeout">Timeout de Sesión (minutos)</label>
        <input type="number" id="sessionTimeout" value="30" min="5" max="240" class="form-control">
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" checked> Requerir 2FA para Administradores
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" checked> Encriptación SSL/TLS
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
}

function openNotificationsConfig() {
  modalTitle.textContent = 'Notificaciones';
  modalBody.innerHTML = `
    <form id="notificationsForm">
      <div class="form-group">
        <label>
          <input type="checkbox" checked> Notificaciones por Email
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox" checked> Alertas de Sistema
        </label>
      </div>
      <div class="form-group">
        <label>
          <input type="checkbox"> Notificaciones por SMS
        </label>
      </div>
      <div class="form-group">
        <label for="notifEmail">Email de Notificaciones</label>
        <input type="email" id="notifEmail" placeholder="admin@bjourney.com" class="form-control">
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
btnGeneralConfig?.addEventListener('click', openGeneralConfig);
btnDatabaseConfig?.addEventListener('click', openDatabaseConfig);
btnSecurityConfig?.addEventListener('click', openSecurityConfig);
btnNotificationsConfig?.addEventListener('click', openNotificationsConfig);
btnIntegrationsConfig?.addEventListener('click', openIntegrationsConfig);
btnLogsConfig?.addEventListener('click', openLogsConfig);

closeConfigModal?.addEventListener('click', () => {
  configModal.classList.remove('active');
});

configModal?.addEventListener('click', (e) => {
  if (e.target === configModal) {
    configModal.classList.remove('active');
  }
});

// Cargar datos al iniciar
loadSystemStatus();
