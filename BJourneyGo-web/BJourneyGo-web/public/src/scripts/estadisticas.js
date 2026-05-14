import { fetchWithAuth } from '/src/scripts/api.js'

let intranetAuth = localStorage.getItem('intranetAuth')
const authFlag = localStorage.getItem('auth') === 'true'
const isAdminFlag = localStorage.getItem('isAdmin') === 'true'
if (intranetAuth !== 'true' && authFlag && isAdminFlag) {
  localStorage.setItem('intranetAuth', 'true')
  localStorage.setItem('intranetRole', 'admin')
  localStorage.setItem('intranetIsAdmin', 'true')
  intranetAuth = 'true'
}
if (intranetAuth !== 'true') {
  location.replace('/intranet-login')
}

const role = localStorage.getItem('intranetRole') || 'admin'
const agencyName = localStorage.getItem('agencyName') || ''

if (role === 'scanner') {
  location.replace('/intranet/escaner-qr')
}

if (role === 'agency') {
  document.querySelector('.stats-hero h1').textContent = 'Estadisticas de ' + agencyName
  document.querySelector('.lead').textContent = 'Panel de control con metricas de tus ventas, ocupacion y rendimiento.'
}

let cachedStats = null

async function loadStats() {
  try {
    const res = await fetchWithAuth('/api/admin/stats')
    if (!res.ok) throw new Error('stats failed')
    const json = await res.json()
    cachedStats = json
    document.getElementById('monthlyRevenue').textContent = '€' + Math.round(json.monthlyRevenue || 0).toLocaleString('es-ES')
    document.getElementById('ticketsSold').textContent = Math.round(json.ticketsSold || 0).toLocaleString('es-ES')
    document.getElementById('activeCustomers').textContent = Math.round(json.activeCustomers || 0).toLocaleString('es-ES')
    document.getElementById('averageOccupancy').textContent = ((json.averageOccupancy || 0) * 100).toFixed(1) + '%'

    const tbody = document.getElementById('routesTableBody')
    const routes = json.popularRoutes || []
    tbody.innerHTML = routes.map(route => `
      <tr>
        <td><strong>${route.code}</strong></td>
        <td>${route.origin}</td>
        <td>${route.destination}</td>
        <td>${route.sales || 0}</td>
        <td>€${Number(route.revenue || 0).toFixed(2)}</td>
        <td>${Number(route.occupancy || 0).toFixed(1)}%</td>
        <td class="trend-${Number(route.occupancy || 0) >= 70 ? 'up' : 'down'}">
          ${Number(route.occupancy || 0) >= 70 ? '↑' : '↓'}
        </td>
      </tr>
    `).join('') || '<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-muted)">Sin datos</td></tr>'

    updateMetrics(json.performanceMetrics || {})
  } catch (e) {
    // fallback to existing placeholders
  }
}

function updateMetrics(metrics) {
  const avgPurchase = Number(metrics.avgPurchaseMinutes || 0)
  const conversion = Number(metrics.conversionRate || 0)
  const avgTicket = Number(metrics.avgTicket || 0)
  const refund = Number(metrics.refundRate || 0)
  const advance = Number(metrics.advanceBookingRate || 0)

  document.getElementById('metricAvgPurchase').textContent = Number.isFinite(avgPurchase) && avgPurchase > 0 ? `${Math.round(avgPurchase)} min` : '--'
  document.getElementById('metricConversion').textContent = Number.isFinite(conversion) ? `${(conversion * 100).toFixed(1)}%` : '--'
  document.getElementById('metricAvgTicket').textContent = Number.isFinite(avgTicket) ? `€${avgTicket.toFixed(2)}` : '--'
  document.getElementById('metricRefundRate').textContent = Number.isFinite(refund) ? `${(refund * 100).toFixed(1)}%` : '--'
  document.getElementById('metricAdvance').textContent = Number.isFinite(advance) ? `${(advance * 100).toFixed(1)}%` : '--'
}

loadStats()
