// Calendario de Turnos - Script

// Datos de ejemplo (PLANTILLA - se reemplazará con datos reales)
const employees = [
  { id: 1, name: 'Carlos Méndez' },
  { id: 2, name: 'Ana García' },
  { id: 3, name: 'Juan López' },
  { id: 4, name: 'María Rodríguez' },
  { id: 5, name: 'Pedro Martínez' },
  { id: 6, name: 'Laura Fernández' },
  { id: 7, name: 'Diego Sánchez' },
  { id: 8, name: 'Rosa Gómez' },
  { id: 9, name: 'Miguel Torres' },
  { id: 10, name: 'Isabel Pérez' },
  { id: 11, name: 'Antonio Jiménez' },
  { id: 12, name: 'Sofia Ruiz' },
];

// Turnos de ejemplo por día (formato: 'DD-MM-YYYY': [{ employee, shift }])
const shiftsData = {
  '04-01-2026': [
    { employee: 'Carlos Méndez', shift: 'morning' },
    { employee: 'Ana García', shift: 'afternoon' },
    { employee: 'Juan López', shift: 'night' },
  ],
  '05-01-2026': [
    { employee: 'María Rodríguez', shift: 'morning' },
    { employee: 'Pedro Martínez', shift: 'afternoon' },
  ],
  // Más datos se agregarían aquí
};

// Datos de descansos y vacaciones
const absencesData = {
  '08-01-2026': [{ employee: 'Diego Sánchez', type: 'rest' }],
  '15-01-2026': [{ employee: 'Rosa Gómez', type: 'vacation', duration: 5 }],
  // Más datos se agregarían aquí
};

let currentDate = new Date(2026, 0, 1); // Enero 2026
let currentView = 'calendar';
let selectedEmployee = null;

// Elementos del DOM
const calendarGrid = document.getElementById('calendarGrid');
const currentMonthEl = document.getElementById('currentMonth');
const prevMonthBtn = document.getElementById('prevMonth');
const nextMonthBtn = document.getElementById('nextMonth');
const viewButtons = document.querySelectorAll('.view-btn');
const calendarContainer = document.getElementById('calendarViewContainer');
const listContainer = document.getElementById('listViewContainer');
const employeeContainer = document.getElementById('employeeViewContainer');
const exportBtn = document.getElementById('exportBtn');
const printBtn = document.getElementById('printBtn');

// Función para obtener el nombre del mes
function getMonthName(date) {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[date.getMonth()];
}

// Función para generar el calendario
function generateCalendar() {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  // Actualizar título
  currentMonthEl.textContent = `${getMonthName(currentDate)} ${year}`;
  
  // Limpiar calendario
  calendarGrid.innerHTML = '';
  
  // Primer día del mes
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  
  // Días del mes anterior
  for (let i = firstDay - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const dayElement = createDayElement(day, 'other-month');
    calendarGrid.appendChild(dayElement);
  }
  
  // Días del mes actual
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const isToday = today.getDate() === day && 
                    today.getMonth() === month && 
                    today.getFullYear() === year;
    const dayElement = createDayElement(day, isToday ? 'today' : '');
    calendarGrid.appendChild(dayElement);
  }
  
  // Días del próximo mes
  const totalCells = calendarGrid.children.length;
  const remainingCells = 42 - totalCells;
  for (let day = 1; day <= remainingCells; day++) {
    const dayElement = createDayElement(day, 'other-month');
    calendarGrid.appendChild(dayElement);
  }
}

// Función para crear elemento de día
function createDayElement(day, className = '') {
  const dayEl = document.createElement('div');
  dayEl.className = `calendar-day ${className}`;
  
  const dayNumber = document.createElement('div');
  dayNumber.className = 'day-number';
  dayNumber.textContent = day;
  dayEl.appendChild(dayNumber);
  
  const shiftsContainer = document.createElement('div');
  shiftsContainer.className = 'day-shifts';
  
  // Agregar turnos de ejemplo (simulados)
  const shiftTypes = ['morning', 'afternoon', 'night'];
  const randomShifts = Math.random() > 0.6 ? shiftTypes.slice(0, Math.floor(Math.random() * 2) + 1) : [];
  
  randomShifts.forEach(shift => {
    const shiftBadge = document.createElement('div');
    shiftBadge.className = `shift-badge shift-${shift}`;
    const shiftName = {
      morning: 'Mañana',
      afternoon: 'Tarde',
      night: 'Noche'
    };
    shiftBadge.textContent = shiftName[shift];
    shiftsContainer.appendChild(shiftBadge);
  });
  
  dayEl.appendChild(shiftsContainer);
  return dayEl;
}

// Función para llenar tabla de lista de turnos
function generateShiftsTable() {
  const tbody = document.getElementById('shiftsTableBody');
  tbody.innerHTML = '';
  
  employees.forEach(emp => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${emp.name}</td>
      <td><span class="shift-badge shift-morning">Mañana</span></td>
      <td><span class="shift-badge shift-afternoon">Tarde</span></td>
      <td><span class="shift-badge shift-night">Noche</span></td>
      <td><span class="shift-badge shift-rest">Descanso</span></td>
    `;
    tbody.appendChild(row);
  });
}

// Función para generar lista de empleados
function generateEmployeeList() {
  const employeeItems = document.getElementById('employeeItems');
  employeeItems.innerHTML = '';
  
  employees.forEach(emp => {
    const item = document.createElement('div');
    item.className = 'employee-item';
    item.textContent = emp.name;
    item.addEventListener('click', () => selectEmployee(emp.id, emp.name));
    employeeItems.appendChild(item);
  });
}

// Función para seleccionar empleado
function selectEmployee(id, name) {
  selectedEmployee = id;
  
  // Actualizar estado activo
  document.querySelectorAll('.employee-item').forEach(item => {
    item.classList.remove('active');
  });
  event.target.classList.add('active');
  
  // Mostrar detalle del empleado
  const detailDiv = document.getElementById('employeeDetail');
  detailDiv.innerHTML = `
    <div class="employee-calendar">
      <div class="employee-name">${name}</div>
      <p style="color: var(--text-muted); margin-bottom: 1rem;">Turnos del mes actual:</p>
      <div class="employee-shifts-list">
        <div class="employee-shift-item" style="background: #3B82F6; color: white;">Mañana</div>
        <div class="employee-shift-item" style="background: #F59E0B; color: white;">Tarde</div>
        <div class="employee-shift-item" style="background: #8B5CF6; color: white;">Noche</div>
        <div class="employee-shift-item" style="background: #10B981; color: white;">Descanso</div>
        <div class="employee-shift-item" style="background: #EF4444; color: white;">Vacaciones</div>
        <div class="employee-shift-item">Disponible</div>
        <div class="employee-shift-item">Disponible</div>
      </div>
      <p style="color: var(--text-muted); margin-top: 1rem; font-size: 0.85rem;">
        Nota: Los datos de turnos son plantillas de ejemplo. Se actualizarán con datos reales del sistema.
      </p>
    </div>
  `;
}

// Event listeners para navegación de meses
prevMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() - 1);
  generateCalendar();
});

nextMonthBtn.addEventListener('click', () => {
  currentDate.setMonth(currentDate.getMonth() + 1);
  generateCalendar();
});

// Event listeners para cambiar vista
viewButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    viewButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    currentView = btn.getAttribute('data-view');
    
    calendarContainer.classList.toggle('hidden', currentView !== 'calendar');
    listContainer.classList.toggle('hidden', currentView !== 'list');
    employeeContainer.classList.toggle('hidden', currentView !== 'employee');
  });
});

// Event listeners para acciones
exportBtn.addEventListener('click', () => {
  alert('Exportar calendario (CSV)\n\nEsta funcionalidad se implementará para exportar los turnos a un archivo CSV.');
});

printBtn.addEventListener('click', () => {
  window.print();
});

document.getElementById('settingsBtn')?.addEventListener('click', () => {
  alert('Ajustes de Turnos\n\nPanel de configuración para crear y modificar tipos de turnos.');
});

// Inicializar
generateCalendar();
generateShiftsTable();
generateEmployeeList();
