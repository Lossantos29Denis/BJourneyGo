import { fetchWithAuth } from '/src/scripts/api.js'

const intranetAuth = localStorage.getItem('intranetAuth')
if (intranetAuth !== 'true') {
  location.replace('/intranet-login')
}

const role = localStorage.getItem('intranetRole') || 'admin'
const agencyName = localStorage.getItem('agencyName') || ''

if (role === 'agency') {
  document.querySelector('.page-hero h1').textContent = `Calendario de Turnos - ${agencyName}`
  document.querySelector('.lead').textContent = 'Gestiona y visualiza los horarios de trabajo de tu agencia.'
}

let employees = []
let shifts = []
let shiftsByDay = {}
let events = []
let eventsByDay = {}
let trips = []
let tripsByDay = {}

let currentDate = new Date()
let currentView = 'calendar';
let selectedEmployee = null;

// minimal bindings for public copy
function formatDateKey(year, month, day) {
  const m = String(month + 1).padStart(2, '0')
  const d = String(day).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function rebuildShiftMap() {
  shiftsByDay = shifts.reduce((acc, shift) => {
    const key = String(shift.shiftDate).slice(0, 10)
    if (!acc[key]) acc[key] = []
    acc[key].push(shift)
    return acc
  }, {})
}

async function loadUsers() {
  try {
    const res = await fetchWithAuth('/api/admin/shift-users')
    if (!res.ok) throw new Error('users failed')
    const json = await res.json()
    employees = json.users || []
  } catch (e) {
    employees = []
  }
}

async function loadShifts() {
  try {
    const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`
    const res = await fetchWithAuth(`/api/admin/shifts?month=${month}`)
    if (!res.ok) throw new Error('shifts failed')
    const json = await res.json()
    shifts = json.shifts || []
  } catch (e) {
    shifts = []
  }
  rebuildShiftMap()
}

document.addEventListener('DOMContentLoaded', async () => {
  await Promise.all([loadUsers(), loadShifts()])
})
